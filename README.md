# flatback

Flatten control flow of callback based asynchronous functions using generators.  The aims for this module are the following:
- Maintain the distinction between errors passed to callbacks and thrown exceptions.
- Concurrent execution should be intuitive and not require dedicated library functions.  `Promise.all([P1, ..., Pn])` and `Promise.race([P1, ..., Pn])` i'm looking at you.
- Arguments should be passable into the generator function so integration with other libraries is easy.

This is achieved by yielding functions within the generator function, each function takes a number of callbacks as arguments and data is passed back from these in a yielded array at the corresponding index.  The magic behind this works by flatback checking the length property on the function supplied to find the number of callbacks to expect.  To make concurrent execution simple and composable, the following rules govern these callbacks:
- Execution only returns to the generator when all callbacks have been called.  This means the time taken will be as slow as the slowest task if a different callback is used for each.
- Each callback can only be called once, later calls are ignored.  This means the time taken will be as slow as the fastest task if one callback is shared by tasks, however data passed back from later calls is lost.
- A try catch block can be placed around a yielded expression and will trap any synchronous exceptions occurring there.

## Installation

```
$ npm install flatback
```

## Examples

### Connecting fs.readFile to an express route

Flatback.func returns a function that can be used directly, in this case to handle an incomming express http request.  When yielding a function, if a single callback is used, the array returned by the yield will exactly match the data passed to it, here the err & data from reading a file.
```js
const flatback = require('flatback');
const fs = require('fs');
const express = require('express');
const app = express();
 
app.get('/file/:filename', flatback.func(function* (req, res, next) {
  const [err, data] = yield callback => {
    fs.readFile('/somewhere/' + req.params.filename, 'utf8', callback);
  }
  if (err){
    return res.status(500).send({
      status: 'something went wrong'
    });
  }
  return res.status(200).send({
    status: 'ok',
    fileData: data
  });
}));
 
app.listen(3000);
```

### HTTP get requests in parallel (after all have finished)

flatback.exec works like flatback.func but runs immediately with no option to pass in arguments.  Note also the three callback arguments (error, response, body) collected from request are no issue here.

Waiting for all of a number of processes to complete is achieved by yielding a function with that many callback arguments.

```js
const flatback = require('flatback');
const request = require('request');

flatback.exec(function* () {
  const [
    [error1, response1, body1], 
    [error2, response2, body2]
  ] = yield (callback1, callback2) => {
    request('http://somewhere/resource', callback1);
    request('http://somewhere/different-resource', callback2);
  }
  if (error1 || error2){
    // handle errors
  }
  // do something with response1, response2, body1 & body2
});
```

### HTTP get requests in parallel (after the first finishes)

As only the first call to each callback is used (the others being silently ignored), waiting for the first of a number of processes to complete can be achieved by using the same callback for them all.

```js
const flatback = require('flatback');
const request = require('request');

flatback.exec(function* () {
  const [error, response, body] = yield (callback) => {
    request('http://somewhere/resource', (error, response, body) => {
      if (!error){
        callback(null, response, body);
      } // else do something with error
    });
    
    request('http://somewhere-else/mirror-resource', (error, response, body) => {
      if (!error){
        callback(null, response, body);
      } // else do something with error
    });
    
    setTimeout(() => {
      callback(new Error('something went wrong');
    }, 10000);
  }
  if (error){
    // handle error
  }
  // do something with response & body
});
```

### Exception handling

Synchronous exceptions thrown in yielded functions can be caught by try catch logic at the generator level.

```js
const flatback = require('flatback');

const object = {}
flatback.exec(function* () {
  try {
    const [error, result] = yield (callback) => {
      object.missing.stuff; // throws an Error
      callback('foo', 'bar');
    }
    // never get to this part of the code
  } catch (err){
    // err.message: 'Cannot read property 'stuff' of undefined'
  }
});
```

## API

### function = flatback.func(function*)

Returns a function that will execute the control flow described by the generator function.  The return value from that function will always be undefined.

```js
const myAsyncFunction = flatback.func(function* (description){
  // description == 'foo'
  const [err, result] = yield callback => {
    otherAsyncFunction(description, callback);
  }
  // handle err & result
});
myAsyncFunction('foo');
```

### flatback.exec(function*)

Immediately executes the control flow described by the generator function.  No arguments can be passed in and the return value will always be undefined.

```js
flatback.exec(function* (){
  const description == 'foo'
  const [err, result] = yield callback => {
    otherAsyncFunction(description, callback);
  }
  // handle err & result
});
```

### flatback.once(function, callback)

If only one yield statement is needed, this function can be used to remove the need for a generator function entirely.  The first argument is the function that would have been yielded and the result is passed directly to the arguments of the callback.

```js
flatback.once(callback => {
    callback('foo', 'bar');
  },
  (arg1, arg2) => {
    // arg1 == 'foo', arg2 == 'bar'
  }
});

flatback.once((callback1, callback2) => {
    callback1('foo', 'bar');
    callback2('baz', 'qux');
  },
  ([arg1, arg2], [arg3, arg4]) => {
  // arg1 == 'foo', arg2 == 'bar', arg3 == 'baz', arg4 == 'qux'
  }
});
```

### yield function (with one callback)

The function will immediately execute and control will return to the generator after the function has completed AND the callback has been called.  Callback calls after the first are ignored.  The yield will return an array containing the arguments passed to the callback in order.

```js
flatback.exec(function* (){
  const [arg1, arg2] = yield callback => {
    callback('foo', 'bar');
  }
  // arg1 == 'foo', arg2 == 'bar'
});
```

### yield function (with multiple callbacks)

This works as in the case of a function with one argument except control returns to the generator only after the function has completed AND ALL the callbacks have been called.  The yield will return an array of arrays containing the arguments passed to each callback in the supplied function.  

Note also if the function has no callbacks, control returns to the generator immediately after it is executed and an empty array is returned by the yield.

```js
flatback.exec(function* (){
  const [
    [arg1, arg2], 
    [arg3, arg4]
  ] = yield (callback1, callback2) => {
    callback1('foo', 'bar');
    callback1('not foo', 'not bar'); // second call ignored
    callback2('baz', 'qux');
  }
  // arg1 == 'foo', arg2 == 'bar', arg3 == 'baz', arg4 == 'qux'
});
```

### yield undefined

This is a shorthand for `yield (callback) => setTimeout(() => callback(),0)`.  It can be used during computationally heavy operations to prevent the event loop getting starved.

```js
flatback.exec(function* (){
  // do something that blocks the event loop
  yield;
  // do something else that blocks the event loop
});
```

### yield array of functions

In some cases the number of tasks required to be done in parallel could be variable, this only complicates things if you wish to return after all of them complete, not just the first as only a single callback would be needed then.

In these cases it is possible to yield an array of functions.  The functions are evaluated in array order and the results that would have been yielded are instead placed in the corresponding position in a new array.  When all callbacks of all functions have completed, this new array of results is returned.

If any function throws a synchronous exception, execution will immediately cease, later elements in the array will not be evaluated to ensure no exception get silently ignored.  These exceptions can be caught as with any other yielded exception.

```js
flatback.exec(function* (){
  const ids = yield callback => getListOfIds(callback);
  // ids == [13, 24, 35, ...]
  
  const things = yield ids.map(id => callback => getThingFromId(id, callback));
  // things == [['thing13'], ['thing24'], ['thing35'], ...]
});
```

## License

MIT