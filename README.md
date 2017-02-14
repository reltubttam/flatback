# flatback

Flatten control flow of asynchronous behaviour in a manner consistent with async / await.  Both callbacks and promises are supported and can be mixed freely.  The aims for this module are the following:
- Maintain the distinction between errors passed to callbacks and thrown exceptions.
- Concurrent execution of callbacks should be intuitive and not require dedicated library functions as with promises.
- Callback arguments should be passable into the flow, in addition, it should be possible to return a promise from it.  Integration with other libraries is important.

The behaviour of async / await is replicated exactly by using `flatback.async` and passing in a generator function.  If you prefer to get the result via a callback, switch to `flatback.func` and pass the callback as a parameter to the generator function.  In both cases, within the generator function, yielding promises will work the same as awaiting promises inside an async function.

As well as yielding promises, callback accepting functions are also supported by yielding functions that take only callback arguments.  The result of the yield will then be the data passed to each callback in an array reflecting the argument's position.  To make concurrent execution simple and composable, the following rules govern these callbacks:
- Execution only returns to the generator when all callbacks have been called.  This means the time taken will be as slow as the slowest task if a different callback is used for each.
- Each callback can only be called once, later calls are ignored.  This means the time taken will be as slow as the fastest task if one callback is shared by tasks, however data passed back from later calls is lost.
- Where the number of callbacks required is not fixed, an array of functions can be built to the required length and then yielded.  The results that each of the functions within it would produce are then returned in the appropriate place in an array.
- A try catch block can be placed around any yielded expression and will trap any synchronous exceptions occurring there.

The magic behind this works by flatback checking the length property on the yielded function to find the number of callbacks to expect.


## Installation

```
$ npm install flatback
```

## Examples

### Connecting fs.readFile to an express route

`flatback.func` returns a function that can be used directly, in this case to handle an incoming express http request.  When yielding a function within the generator function, if a single callback is used, the array returned by the yield will exactly match the data passed to it, here the err & data from reading a file.
```js
const flatback = require('flatback');
const fs = require('fs');
const express = require('express');
const app = express();
 
app.get('/file/:filename', flatback.func(function* (req, res, next) {
  const [error, data] = yield callback => {
    fs.readFile('./' + req.params.filename, 'utf8', callback);
  }
  if (error){
    return res.status(500).send({
      status: 'something went wrong',
      fileError: error
    });
  }
  return res.status(200).send({
    status: 'ok',
    fileData: data
  });
}));
 
app.listen(3000);
```

### HTTP get requests in parallel

`flatback.exec` works like `flatback.func` but runs immediately with no option to pass in arguments.  Note also the three callback arguments (error, response, body) collected from request are no issue for flatback.

If `resource` is collected before `mirror-resource`, the system will not wait for the slower as only the first call to each callback is used.  The system will however wait for `different-resource` if it is slow as it uses a different callback.  Finally the `setTimeout` will handle the case neither are successful.

```js
const flatback = require('flatback');
const request = require('request');

flatback.exec(function* () {
  const [
    [error1, response1, body1],
    [error2, response2, body2]
  ] = yield (callback1, callback2) => {
  
    request('http://somewhere/resource', (error, response, body) => {
      if (!error){
        callback1(null, response, body);
      } // else do something with error
    });
    
    request('http://somewhere-else/mirror-resource', (error, response, body) => {
      if (!error){
        callback1(null, response, body);
      } // else do something with error
    });
    
    request('http://somewhere/different-resource', (error, response, body) => {
      if (!error){
        callback2(null, response, body);
      } // else do something with error
    });
    
    setTimeout(() => {
      callback1(new Error('something went wrong'));
      callback2(new Error('something went wrong'))
    }, 10000);
  };
  if (error1 || error2){
    // handle error
  }
  // do something with responses & bodies
});
```

## API

### function = flatback.func(function*)

Returns a function that will execute the control flow described by the generator function.  The return value from that function will always be undefined.

```js
const myNewFunction = flatback.func(function* (description){
  // description == 'foo'
  const [error, result] = yield callback => {
    asyncFunction(description, callback);
  }
  // handle error & result
});

myNewFunction('foo');
```

### flatback.exec(function*)

Immediately executes the control flow described by the generator function.  No arguments can be passed in and the return value will always be undefined.

```js
flatback.exec(function* (){
  const description = 'foo';
  const [error, result] = yield callback => {
    asyncFunction(description, callback);
  }
  // handle error & result
});
```

### flatback.once(function or promise, resolved callback, optional rejected callback)

`flatback.once` immediately executes one yield step when called.  The first argument is what would have been yielded and the result is passed directly as the arguments of the resolved callback.  A rejected callback can optionally also be provided which will collect any exceptions or failed promises, if omitted these exceptions will be thrown.  Either the resolved callback or the rejected callback will be called, never both.

```js  
flatback.once((callback1, callback2) => {
    asyncFunction(callback1);
    asyncFunction(callback2);
  },
  ([error1, result1], [error2, result2]) => {
    // handle errors & results
  },
  exception => {
    // handle exception
});
```

### function = flatback.async(function*)

Returns a function that will return a promise to execute the control flow described by the generator function.  The return value from the generator function or any unhandled exception thrown before it is reached will be available by calling `.then()` or `.catch()` on the promise.

```js
const myNewAsyncFunction = flatback.async(function* (description){
  // description == 'foo'
  const [error, result] = yield callback => {
    asyncFunction(description, callback);
  }
  // handle error
  return result;
});

myNewAsyncFunction('foo').then(result => {
	// handle result
});
```

### yield promise

The promise will immediately evaluate and if it resolves, the yield will return the resolved value.  If the promise rejects, a corresponding exception will be thrown.

```js
flatback.exec(function* (){
  const result = yield promise.resolve('foo');
  // result == 'foo'
});
```

### yield function (with one callback)

The function will immediately execute and control will return to the generator after the function has completed AND the callback has been called.  Callback calls after the first are ignored.  The yield will return an array containing the arguments passed to the callback in order.

```js
flatback.exec(function* (){
  const [arg1, arg2] = yield callback => {
    callback('foo', 'bar');
    callback('not foo', 'not bar'); // second call ignored
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

### yield array of functions or promises

The elements are evaluated in array order and the results that would have been yielded are instead placed in the corresponding position in a new array.  When all callbacks of all functions have completed, this new array of results is returned.

If any function throws a synchronous exception, execution will immediately cease, later elements in the array will not be evaluated to ensure only one exception can ever be thrown and none are ever silently ignored.  Exceptions from promises are always synchronous and if one occurs, the first one is used and later exceptions from the same array are swallowed.

```js
flatback.exec(function* (){
  const [err, ids] = yield callback => getListOfIds(callback);
  // ids == [13, 24, 35, ...]
  
  const getAllThingsFromIds = ids.map(id => callback => getThingFromId(id, callback));
  /**
   * getAllThingsFromIds == [
   *   callback => getThingFromId(13, callback), 
   *   callback => getThingFromId(24, callback), 
   *   callback => getThingFromId(35, callback),
   *   ...
   * ]
   */
   
  const things = yield getAllThingsFromIds;
  // things == [[err13, thing13], [err24, thing24], [err35, thing35], ...]
});
```

### yield undefined

This is a shorthand for `yield (callback) => setTimeout(() => callback(),0)`.  It can be used during computationally heavy operations to prevent the event loop starving or prevent the call stack getting to large.

```js
flatback.exec(function* (){
  // do something big synchronously
  yield;
  // do something else big synchronously
});
```

### Exception handling

Synchronous exceptions thrown in yielded functions can be caught by try catch logic at the generator level, synchronous execution will immediately cease in the yield.  In the case of yielded arrays of functions, if one function throws an exception, functions later in the array will not be triggered.  In the case of failed yielded promises, rejections will cause an error in the same manner and can be caught as such.

If `flatback.async` is used, uncaught exceptions will cause the resultant promise to reject with the error thrown.  In all other cases, the error will follow the usual javascript error propagation logic.

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
  } catch (exception){
    // exception.message: 'Cannot read property 'stuff' of undefined'
  }
});
```

## License

MIT