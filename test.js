"use strict";

const assert = require('assert');
const flatback = require('./index');

describe('flatback.func', () => {
  it('works', (done) => {
    const testF = flatback.func(function* (a, b){
      assert.equal(a, 'foo', '1st parameter should pass in');
      assert.equal(b, 'bar', '2nd parameter should pass in');
      
      const events = [];
      const [err1, result1] = yield callback => {
        events.push('in yielded function');
        callback('err1', 'success1');
        events.push('after callback');
      };
      events.push('after yielded function');
      assert.equal(err1, 'err1', 'err1 should be err1');
      assert.equal(result1, 'success1', 'result1 should be success1');
      assert.deepEqual(events, ['in yielded function','after callback','after yielded function'], 'should return after sync execution and callback');
      
      const [err2, result2] = yield callback2 => {
        setTimeout(() => callback2('err2', 'success2'), 0);
      };
      assert.equal(err2, 'err2', 'err2 should be err2');
      assert.equal(result2, 'success2', 'result2 should be success2');
      done();
    });
    
    testF('foo', 'bar');
  });
  
  it('has a length', function (done) {
    const twoParams = flatback.func(function* (a, b){});
    assert.equal(twoParams.length, 2, 'length should be same as generator function (2)');
    const noParams = flatback.func(function* (){});
    assert.equal(noParams.length, 0, 'length should be same as generator function (0)');
    done();
  });
});

describe('flatback.exec', () => {
  it('works', (done) => {
    flatback.exec(function* (){
      const events = [];
      const [err1, result1] = yield callback => {
        events.push('in yielded function');
        callback('err1', 'success1');
        events.push('after callback');
      };
      events.push('after yielded function');
      assert.equal(err1, 'err1', 'err1 should be err1');
      assert.equal(result1, 'success1', 'result1 should be success1');
      assert.deepEqual(events, ['in yielded function','after callback','after yielded function'], 'should return after sync execution and callback');
      
      const [err2, result2] = yield callback2 => {
        setTimeout(() => callback2('err2', 'success2'), 0);
      };
      assert.equal(err2, 'err2', 'err2 should be err2');
      assert.equal(result2, 'success2', 'result2 should be success2');
      done();
    });
  });
});

describe('flatback.once', () => {
  it('works with a resolved callback', (done) => {
    flatback.once(callback => {
      callback('err', 'success');
    }, (err, result) => {
      assert.equal(err, 'err', 'err should be err');
      assert.equal(result, 'success', 'result1 should be success');
      done();
    });
  });
  
  it('works with a rejected callback', (done) => {
    flatback.once(Promise.reject(new Error('err')),
      (result) => {},
      (err) => {
        assert.equal(Object.prototype.toString.call(err), '[object Error]');
        assert.equal(err.message, 'err');
        done();
      });
  });
  
  it('ignore all but first call to each callback', (done) => {
    flatback.once((callback1, callback2) => {
      callback1('err1', 'success1');
      callback1('ignored err', 'ignored success');
      callback2('err2', 'success2');
    }, ([err1, result1], [err2, result2]) => {
      
      assert.equal(err1, 'err1', 'err1 should be err1');
      assert.equal(result1, 'success1', 'result1 should be success1');
      assert.equal(err2, 'err2', 'err2 should be err2');
      assert.equal(result2, 'success2', 'result2 should be success2');
      done();
    });
  });
});

describe('flatback.async', () => {
  it('works', (done) => {
    const testF = flatback.async(function* (a, b){
      assert.equal(a, 'foo', '1st parameter should pass in');
      assert.equal(b, 'bar', '2nd parameter should pass in');
      
      const events = [];
      const [err1, result1] = yield callback => {
        events.push('in yielded function');
        callback('err1', 'success1');
        events.push('after callback');
      };
      events.push('after yielded function');
      assert.equal(err1, 'err1', 'err1 should be err1');
      assert.equal(result1, 'success1', 'result1 should be success1');
      assert.deepEqual(events, ['in yielded function','after callback','after yielded function'], 'should return after sync execution and callback');
      
      const [err2, result2] = yield callback2 => {
        setTimeout(() => callback2('err2', 'success2'), 0);
      };
      assert.equal(err2, 'err2', 'err2 should be err2');
      assert.equal(result2, 'success2', 'result2 should be success2');
      done();
    });
    
    testF('foo', 'bar');
  });
  
  it('has a length', function (done) {
    const twoParams = flatback.async(function* (a, b){});
    assert.equal(twoParams.length, 2, 'length should be same as generator function (2)');
    const noParams = flatback.async(function* (){});
    assert.equal(noParams.length, 0, 'length should be same as generator function (0)');
    done();
  });
  
  it('handles returned values', (done) => {
    const testF = flatback.async(function* (){
      return 'success';
    });
    
    testF().then(result => {
      assert.equal(result, 'success', 'result should be success');
      done();
    }).catch(e=>console.log(e));
  });
  
  it('handles thrown errors', (done) => {
    const testF = flatback.async(function* (){
      throw new Error('err');
    });
    
    testF().catch(err => {
      assert.equal(Object.prototype.toString.call(err), '[object Error]');
      assert.equal(err.message, 'err');
      done();
    });
  });
});

describe('yielded functions', () => {
  it('ignore all but first call to each callback', flatback.func(function* (done){
    const [
      [err1, result1], 
      [err2, result2]
    ] = yield (callback1, callback2) => {
      callback1('err1', 'success1');
      callback1('ignored err', 'ignored success');
      callback2('err2', 'success2');
    };
    assert.equal(err1, 'err1', 'err1 should be err1');
    assert.equal(result1, 'success1', 'result1 should be success1');
    assert.equal(err2, 'err2', 'err2 should be err2');
    assert.equal(result2, 'success2', 'result2 should be success2');
    done();
  }));
  
  it('can be undefined', flatback.func(function* (done){ 
    // TODO check setTimeout occurs
    const result = yield;
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 0);
    done();
  }));
    
  it('can be an empty array', flatback.func(function* (done){ 
    // TODO check setTimeout occurs
    const result = yield [];
    assert.equal(Array.isArray(result), true);
    assert.equal(result.length, 0);
    done();
  }));
  
  it('can be in arrays, one callback two functions', flatback.func(function* (done){
    const [
      [err1, result1],
      [err2, result2]
    ] = yield [
      callback => callback('err1', 'success1'),
      callback => callback('err2', 'success2')
    ];
    assert.equal(err1, 'err1', 'err1 should be err1');
    assert.equal(result1, 'success1', 'result1 should be success1');
    assert.equal(err2, 'err2', 'err2 should be err2');
    assert.equal(result2, 'success2', 'result2 should be success2');
    done();
  }));
  
  it('can be in arrays, two callbacks one function', flatback.func(function* (done){
    const [[
      [err1, result1], 
      [err2, result2]
    ]] = yield [(callback1, callback2) => {
      callback1('err1', 'success1');
      callback2('err2', 'success2');
    }];
    assert.equal(err1, 'err1', 'err1 should be err1');
    assert.equal(result1, 'success1', 'result1 should be success1');
    assert.equal(err2, 'err2', 'err2 should be err2');
    assert.equal(result2, 'success2', 'result2 should be success2');
    done();
  }));
  
  it('can be in arrays, one callback one promise', flatback.func(function* (done){
    const [
      [err1, result1], 
      result2
    ] = yield [
      callback => callback('err1', 'success1'),
      Promise.resolve('success2')
    ];
    assert.equal(err1, 'err1', 'err1 should be err1');
    assert.equal(result1, 'success1', 'result1 should be success1');
    assert.equal(result2, 'success2', 'result2 should be success2');
    done();
  }));
});

describe('yielded promises', () => {
  it('handle yielded results correctly', flatback.func(function* (done){
    const result = yield Promise.resolve('success');
    assert.equal(result, 'success');
    done();
  }));
  
  it('handle yielded errors correctly', flatback.func(function* (done){
    try {
      const result = yield Promise.reject(new Error('err'));
    } catch(err){
      assert.equal(Object.prototype.toString.call(err), '[object Error]');
      assert.equal(err.message, 'err');
      done();
    }
  }));
});

describe('parallel usage', function () {
  it('works in correct order', flatback.func(function* (done){
    const events = [];
    function makeFlatbackFunction (name, timeoutMS){
      return flatback.func(function* (outerCallback){
        events.push(`${name} start`);
        let ffResult1 = yield innerCallback => setTimeout(() => {
          events.push(`${name} timeout callback sending`);
          innerCallback('result1');
          events.push(`${name} timeout callback sent`);
        }, timeoutMS);
        
        let ffResult2 = yield innerCallback => {
          events.push(`${name} sync callback sending`);
          innerCallback('result2');
          events.push(`${name} sync callback sent`);
        };
        
        events.push(`${name} outer callback sending`);
        outerCallback(ffResult1, ffResult2);
        events.push(`${name} outer callback sent`);
      });
    }
    
    yield (callback1, callback2) => {
      makeFlatbackFunction('first', 50)(callback1);
      makeFlatbackFunction('second', 100)(callback2);
    };
    events.push('empty yield sending');
    yield;
    events.push('empty yield sent');

    assert.deepEqual(events, [
      'first start',
      'second start',
      
      'first timeout callback sending',
      'first sync callback sending',
      'first sync callback sent',
      'first outer callback sending',
      'first outer callback sent',
      'first timeout callback sent',
      
      'second timeout callback sending',
      'second sync callback sending',
      'second sync callback sent',
      'second outer callback sending',
      
      'empty yield sending',
      'second outer callback sent',
      'second timeout callback sent',
      'empty yield sent'
    ]);
    done();
  }));
});

describe('errors', function () {
  it('can be caught', flatback.func(function* (done){
    const badYields = [
      null,
      180,
      "360",
      function*(){},
      (callback) => {
        assert.fail('something', 'broke', 'oops1');
      },
      (callback) => {
        callback();
        assert.fail('something', 'broke', 'oops2');
      },
      flatback.func(function* (callback){
        yield s => s();
        assert.fail('something', 'broke', 'oops3');
      }),
      [(callback) => {
        assert.fail('something', 'broke', 'oops4');
      }],
      [
        [],
        (callback) => {
          assert.fail('something', 'broke', 'oops5');
        },(callback) => {
          assert.fail('something', 'broke', 'not oops5');
        }
      ]
    ];
    const errors = [];
    for (const badYield of badYields){
      try {
        result = yield badYield;
      } catch(err){
        errors.push(err);
      }
    }
    assert(badYields.length = errors.length);
    [
      {
        messageSubStr: 'Null: null',
        name: 'TypeError'
      }, {
        messageSubStr: 'Number: 180',
        name: 'TypeError'
      }, {
        messageSubStr: 'String: 360',
        name: 'TypeError'
      }, {
        messageSubStr: 'GeneratorFunction:',
        name: 'TypeError'
      }, {
        messageSubStr: 'oops1',
        name: 'AssertionError'
      }, {
        messageSubStr: 'oops2',
        name: 'AssertionError'
      }, {
        messageSubStr: 'oops3',
        name: 'AssertionError'
      }, {
        messageSubStr: 'oops4',
        name: 'AssertionError'
      }, {
        messageSubStr: 'oops5',
        name: 'AssertionError'
      }
    ].forEach((expected, index) => {
      assert.equal(errors[index].name, expected.name, 'error name should be correct');
      assert(errors[index].message.indexOf(expected.messageSubStr) != -1, 'error message should be correct');
    });
    done();
  }));
});