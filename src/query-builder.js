import { chain } from 'lodash';
import * as utils from './utils';

export class QueryBuilder {
  constructor(items, _getter, runQuery, makeTest) {
    this.items = items;
    this.runQuery = runQuery;
    this.makeTest = makeTest;
    this.theQuery = {};
    this._getter = _getter;

    const _all = this.all.bind(this);

    this.run = _all;
    this.query = _all;
    this.find = _all;
  }

  all(items, first) {
    if (items) {
      this.items = items;
    } else {
      items = this.items;
    }

    return this.runQuery(items, this.theQuery, this._getter, first);
  }

  chain() {
    return chain(this.all.apply(this, arguments));
  }

  tester() {
    return this.makeTest(this.theQuery, this._getter);
  }

  first(items) {
    return this.all(items, true);
  }

  getter(_getter) {
    this._getter = _getter;
    return this;
  }
}

const addToQuery = type => {
  return function(params, qVal) {
    if (qVal) {
      params = utils.makeObj(params, qVal);
    }

    this.theQuery[type] = this.theQuery[type] || [];
    this.theQuery[type].push(params);

    return this;
  };
};

for (let key of utils.compoundKeys) {
  QueryBuilder.prototype[key.substr(1)] = addToQuery(key);
}
