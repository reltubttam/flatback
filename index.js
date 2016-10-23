"use strict";

/**
 * return a function from the supplied generator function.
 * @param {generator function} genFunction - describes control flow
 * @returns {function} - executable function that always returns undefined
 */
function func(genFunction){
  function exec(){
    const gen = genFunction.apply(null, Array.from(arguments));
    step(gen);
    return;
  };
  return Object.defineProperty(exec, "length", {value: genFunction.length});
}

/**
 * immediately executes the supplied generator function.
 * @param {generator function} genFunction - describes control flow
 * @returns {undefined}
 */
function exec(genFunction){
  const gen = genFunction();
  step(gen);
  return;
}

/**
 * immediately execute the supplied function as if it were yielded within a flatback.exec call.
 * arguments passed to the callback match those that would have been yielded
 * @param {function} flatBackFunction - function to collect all arguments passed to callbacks from
 * @param {function} callback - function to collect all arguments passed to callbacks from
 * @returns {undefined}
 */
function once(flatBackFunction, callback){
  getNextResult(flatBackFunction, function (err, results){
    if (err){
      throw err
    } 
    if (flatBackFunction.length == 1){  // f(callback) => foo, bar, ...
        return callback.apply(null, results[1]);
    } else {  // f(callback1, callback2, ...) => [foo1, bar1, ...], [foo2, bar2, ...], ...
      return callback.apply(null, results.slice(1));
    }
  });
  return;
}

/**
 * call next on generator and decide how to handle the result.
 * @param {generator} gen - contains control flow
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
  
  const classString = Object.prototype.toString.call(next.value).slice(8, -1);
  if (next.done){
    return;
  } else if (classString == 'Undefined'){
    setTimeout(() => step(gen, null, []), 0);
    return;
  } else if (classString != 'Function'){
    return step(gen, new TypeError(`You may only yield a function or undefined to flatback.  Recieved ${classString}: ${String(next.value)}`));
  } else if (!next.value.length){
    try {
      next.value();
    } catch(err){
      return step(gen, err);
    }
    return step(gen, null, []);
  } else {
    return getNextResult(next.value, (err, results) => {
      if (err){
        return step(gen, err);
      } else if (next.value.length == 1){ // f(callback) => [foo, bar, ...]
        return step(gen, null, results[1]);
      } else {  // f(callback1, callback2, ...) => [[foo1, bar1, ...], [foo2, bar2, ...], ...]
        return step(gen, null, results.slice(1));
      }
    });
  }
}

/**
 * execute given function with one or more callbacks.  
 * After function completes and all it's callbacks are called, control is passed back to the main callback.
 * @param {function} flatBackFunction - function to collect all arguments passed to callbacks from
 * @param {function} callback - function to pass all results to or an exception if thrown
 * @returns {undefined}
 */
 function getNextResult(flatBackFunction, callback){
  let waitingCount = flatBackFunction.length + 1;
  const waitingFlags = new Array(waitingCount).fill(true);
  const results = new Array(waitingCount);
  const finishedChecks = new Array(waitingCount)
    .fill('')
    .map((_, index) => 
      function (){
        if (waitingFlags[index]){
          waitingFlags[index] = false;
          results[index] = Array.from(arguments);
          waitingCount --;
          if (!waitingCount){
            callback(null, results);
          }
        }
      }
    );
    
  let returned;
  try {
    returned = flatBackFunction.apply(null, finishedChecks.slice(1));
  } catch(err){
    callback(err);
    return;
  }
  return finishedChecks[0](returned);
}

module.exports = {
    func: func,
    exec: exec,
    once: once,
};