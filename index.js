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
 * call next on generator and decide how to handle the result.
 * @param {generator} gen - contains control flow
 * @param {error} err - exception caught in previous function to throw in to generator (if present) 
 * @param {array} result - result from previous iteration to pass in to generator (if no err)
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
  } else if (classString != 'Function'){
    step(gen, new TypeError(`You may only yield a function or undefined to flatback.  Recieved ${classString}: ${String(next.value)}`));
  } else if (!next.value.length){
    try {
      next.value();
    } catch(err){
      return step(gen, err);
    }
    return step(gen, null, []);
  } else {
    return getNextResult(gen, next.value);
  }
}

/**
 * execute given function with one or more callbacks.  
 * After function completes and all callbacks are called, control is passed back to step.
 * if one callback argument is used, results passed to step are the argument passed.  if multiple, results are an array of these.
 * @param {generator} gen - contains control flow
 * @param {function} valueFunction - function to collect all arguments passed to callbacks from
 */
 function getNextResult(gen, valueFunction){
  let waitingCount = valueFunction.length + 1;
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
            if (valueFunction.length == 1){
              return step(gen, null, results[1]);
            } else {
              return step(gen, null, results.slice(1));
            }
          }
        }
      }
    );
    
  let returned;
  try {
    returned = valueFunction.apply(null, finishedChecks.slice(1));
  } catch(err){
    return step(gen, err);
  }
  return finishedChecks[0](returned);
}

module.exports = {
    func: func,
    exec: exec,
};