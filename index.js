"use strict";

/**
 * return a function from the supplied generator function.
 * @param {GeneratorFunction} genFunction - describes control flow
 * @returns {Function} - executable function that always returns undefined
 */
function func(genFunction){
  function exec(){
    const gen = genFunction.apply(null, Array.from(arguments));
    step(gen);
  }
  return Object.defineProperty(exec, "length", {value: genFunction.length});
}

/**
 * immediately execute the supplied generator function.
 * @param {GeneratorFunction} genFunction - describes control flow
 * @returns {undefined}
 */
function exec(genFunction){
  const gen = genFunction();
  step(gen);
}

/**
 * immediately execute the supplied function as if it were yielded within a flatback.exec call
 * arguments passed to the callback match those that would have been yielded.
 * @param {(Function|Function[]|undefined)} value - valid expression to yield
 * @param {Function} callback - function to collect the result of evaluating the value
 * @returns {undefined}
 */
function once(value, callback){
  getNextResult(value, (err, result) => {
    if (err){
      throw err;
    }
    callback.apply(null, result);
  });
}

/**
 * one (recursive) step of generator logic, handling exceptions and iterator termination.
 * @param {GeneratorFunction} gen - contains control flow
 * @param {error} err - js exception caught from previous step to throw in to generator
 * @param {array} result - result from previous iteration to pass in to generator (if no err)
 * @returns {undefined}
 */
function step(gen, err, result){
  let next;
  if (err){
    next = gen.throw(err);
  } else {
    next = gen.next(result);
  }
  
  if (!next.done){
    return getNextResult(next.value, (err, result) => step(gen, err, result));
  }
}

/**
 * decide how to handle yielded value, evaluating trivial cases more efficiently and creating errors for unsupported types
 * arrays and functions may be passed to handleArray or handleFunction.
 * @param {(Function|Function[]|undefined)} value - yielded expression
 * @param {Function} callback - function to collect the result of value (err is only ever synchronous exceptions)
 * @returns {undefined}
 */
function getNextResult(value, callback){
  const classString = Object.prototype.toString.call(value).slice(8, -1);
  if (classString == 'Undefined'){
    setTimeout(() => callback( null, []), 0);

  } else if (classString == 'Array'){
    if (!value.length){  // treat as undefined
      setTimeout(() => callback( null, []), 0);
    } else {
      return handleArray(value, callback);
    }

  } else if (classString == 'Function'){
    if (!value.length){ // return control to generator immediately after execution
      try {
        value();
      } catch(err){
        return callback(err);
      }
      return callback(null, []);
    } else {
      return handleFunction(value, callback);
    }

  } else {
    return callback(new TypeError(`You may only yield a function, undefined or an array of these to flatback.  Recieved ${classString}: ${String(value)}`));
  }
}

/**
 * passes all elements in an array to getNextResult in sequence, calling the callback only when all complete
 * if an exceptions occurs with any element, later elements are never visited.
 * does not need to handle empty arrays, these are caught by getNextResult.
 * @param {(Function|Function[]|undefined)[]} valueArray - array of values to evaluate
 * @param {Function} callback - function to pass all results to, or an exception if thrown synchronously
 * @returns {undefined}
 */
 function handleArray(valueArray, callback){
  let waitingCount = valueArray.length;
  const results = new Array(waitingCount);
  let firstErr = null;
  valueArray.forEach((value, index)=> {
    if (!firstErr){
      getNextResult(value, (err, result) => {
        if (err) { // this can only happen synchronously
          firstErr = err;
        } else {
          results[index] = result;
          waitingCount --;
          if (!waitingCount){ // if all elements have completed, callback the results
            callback(null, results);
          }
        }
      });
    }
  });
  if (firstErr){
    callback(firstErr);
  }
}

/**
 * execute given function with one or more callbacks.
 * After function completes and all it's callbacks are called, control is passed back to the main callback.
 * @param {Function} valueFunction - function to collect all arguments passed to callbacks from
 * @param {Function} callback - function to pass all results to, or an exception if thrown synchronously
 * @returns {undefined}
 */
 function handleFunction(valueFunction, callback){
  let waitingCount = valueFunction.length + 1;
  const waitingFlags = new Array(waitingCount).fill(true);
  const results = new Array(waitingCount);
  const finishedChecks = new Array(waitingCount)
    .fill('')
    .map((_, index) =>
    
      /**
       * update waitingFlags & results then if all finishedChecks have been executed, 
       * pass to main callback the first result each received, formatted according to valueFunction.length
       * returned value from valueFunction is discarded (results[0])
       */
      function (){
        if (waitingFlags[index]){
          waitingFlags[index] = false;
          results[index] = Array.from(arguments);
          waitingCount --;
          if (!waitingCount){
            if (valueFunction.length == 1){ // f(callback) => [foo, bar, ...]
              return callback(null, results[1]);
            } else {  // f(callback1, callback2, ...) => [[foo1, bar1, ...], [foo2, bar2, ...], ...]
              return callback(null, results.slice(1));
            }
          }
        }
      }
    );

  let returned;
  try {
    returned = valueFunction.apply(null, finishedChecks.slice(1));
  } catch(err){
    callback(err);
    return;
  }
  finishedChecks[0](returned); // first finishedCheck is that the valueFunction completed
}

module.exports = {
    func: func,
    exec: exec,
    once: once,
};