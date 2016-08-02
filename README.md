# flatback

Flatten control flow of callback based async functions using generator functions.  The aims for this module are the following:
- Maintain the distinction between errors passed to callbacks and thrown exceptions.
- Concurrent execution should be intuitive and not require special data structure or dedicated library functions.  Promise.all([P1, P2 ... Pn]) i'm looking at you.
- Arguments should be passable into the generator function so integration with other libraries is easy.

## Installation

```
$ npm install flatback
```

## Examples

### Connecting fs.readFile to an express route

flatback.func returns a function that can be used directly in a number of places.

Each yielded function within the generator will be executed immediately, and after it has finished and all it's arguments have been called, control will resume back in the generator.

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

flatback.exec works like flatback.func but runs immediately.

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
  if (err){
    // handle error
    return;
  }
  // handle result
});

myAsyncFunction('foo')
```

### flatback.exec(function*)

Immediately executes the control flow described by the generator function.  No arguments can be passed in and the return value will always be undefined.

```js
flatback.exec(function* (){
  const [err, result] = yield callback => {
    otherAsyncFunction(description, callback);
  }
  if (err){
    // handle error
    return;
  }
  // handle result
});
```

### yield function (with one arguments)

The function will immediately execute and control will return to the generator after the function has completed AND the callback has been called.  Callback calls after the first are ignored.

The yield will return an array containing the arguments passed to the supplied function in order.

```js
flatback.exec(function* (){
  const [arg1, arg2] = yield callback => {
    callback('foo', 'bar');
  }
  // arg1 == 'foo', arg2 == 'bar'
});
```

### yield function (with multiple arguments)

This works as in the case of one argument except control returns to the generator only after the function has completed AND ALL the callbacks have been called.

The yield will return an array of arrays containing the arguments passed to the supplied functions the first time each is called.

If there no arguments to the function, control returns to the generator immediately after it is executed and an empty array is returned by the yield.

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
  // do something computationally expensive
  yield;
  // do something else computationally expensive
});
```

## License

MIT