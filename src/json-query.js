import {
  every,
  some,
  filter,
  first,
  find,
  reduce,
  sortBy,
  indexOf,
  intersection,
  isEqual,
  keys,
  isArray,
  result,
  map,
  includes,
  isNaN,
} from 'lodash';

import * as utils from './utils';
import { QueryBuilder } from './query-builder';

const lookup = function(keysArr, obj) {
  let out = JSON.parse(JSON.stringify(obj));
  let remainingKeys;
  let key;

  for (const idx in keysArr) {
    key = keysArr[idx];

    if (isArray(out)) {
      remainingKeys = keysArr.slice(idx);
      out = map(out, v => lookup(remainingKeys, v));
    } else if (out) {
      out = result(out, key);
    } else {
      break;
    }
  }

  return out;
};

const multipleConditions = function(key, queries) {
  return Object.keys(queries || {}).map(type =>
    utils.makeObj(key, utils.makeObj(type, queries[type])),
  );
};

const parseParamType = function(query) {
  const resultArr = [];
  for (let key in query) {
    if (!Object.prototype.hasOwnProperty.call(query, key)) {
      continue;
    }

    let o = { key };
    const queryParam = query[key];

    if (queryParam != null ? queryParam.$boost : void 0) {
      o.boost = queryParam.$boost;
      delete queryParam.$boost;
    }

    if (key.indexOf('.') !== -1) {
      o.getter = utils.makeGetter(lookup)(key);
    }

    const paramType = utils.getType(queryParam);
    let size;

    switch (paramType) {
      case 'RegExp':
      case 'Date':
        o.type = '$' + paramType.toLowerCase();
        o.value = queryParam;
        break;
      case 'Array':
        if (includes(utils.compoundKeys, key)) {
          o.type = key;
          o.value = parseSubQuery(queryParam, key);
          o.key = null;
        } else {
          o.type = '$equal';
          o.value = queryParam;
        }

        break;
      case 'Object':
        size = keys(queryParam).length;

        if (includes(utils.compoundKeys, key)) {
          o.type = key;
          o.value = parseSubQuery(queryParam, key);
          o.key = null;
        } else if (!(size === 1 || (size === 2 && '$options' in queryParam))) {
          o.type = '$and';
          o.value = parseSubQuery(multipleConditions(key, queryParam));
          o.key = null;
        } else {
          for (let type in queryParam) {
            if (!Object.prototype.hasOwnProperty.call(queryParam, type)) {
              continue;
            }

            const value = queryParam[type];

            if (type === '$options') {
              if ('$regex' in queryParam || 'regexp' in queryParam) {
                continue;
              }
              throw new Error('$options needs a $regex');
            }

            if (testQueryValue(type, value)) {
              o.type = type;

              switch (type) {
                case '$elemMatch':
                  o.value = single(parseQuery(value));
                  break;
                case '$endsWith':
                  o.value = utils.reverseString(value);
                  break;
                case '$likeI':
                case '$startsWith':
                  o.value = value.toLowerCase();
                  break;
                case '$regex':
                case '$regexp':
                  if (typeof value === 'string') {
                    o.value = new RegExp(value, queryParam.$options || '');
                  } else {
                    o.value = value;
                  }
                  break;
                case '$not':
                case '$nor':
                case '$or':
                case '$and':
                  o.value = parseSubQuery(utils.makeObj(o.key, value));
                  o.key = null;
                  break;
                case '$computed':
                  o = first(parseParamType(utils.makeObj(key, value)));
                  o.getter = utils.makeGetter(lookup)(key);
                  break;
                default:
                  o.value = value;
              }
            } else {
              throw new Error(
                'Query value (' +
                  value +
                  ") doesn't match query type: (" +
                  type +
                  ')',
              );
            }
          }
        }
        break;
      default:
        o.type = '$equal';
        o.value = queryParam;
    }

    if (o.type === '$equal' && includes(['Object', 'Array'], paramType)) {
      o.type = '$deepEqual';
    } else if (isNaN(o.value)) {
      o.type = '$deepEqual';
    }

    resultArr.push(o);
  }

  return resultArr;
};

const parseSubQuery = function(rawQuery, type) {
  let queryArray;

  if (isArray(rawQuery)) {
    queryArray = rawQuery;
  } else {
    queryArray = Object.keys(rawQuery)
      .filter(key => Object.prototype.hasOwnProperty.call(rawQuery, key))
      .map(key => utils.makeObj(key, rawQuery[key]));
  }

  const iteratee = (memo, query) => {
    const parsed = parseParamType(query);

    if (type === '$or' && parsed.length >= 2) {
      memo.push({
        type: '$and',
        parsedQuery: parsed,
      });

      return memo;
    } else {
      return memo.concat(parsed);
    }
  };

  const resultArr = reduce(queryArray, iteratee, []);

  return sortBy(resultArr, x => {
    const index = indexOf(utils.tagSortOrder, x.type);

    if (index >= 0) {
      return index;
    }

    return Infinity;
  });
};

const testQueryValue = function(queryType, value) {
  const valueType = utils.getType(value);

  switch (queryType) {
    case '$in':
    case '$nin':
    case '$all':
    case '$any':
    case '$none':
      return valueType === 'Array';
    case '$size':
      return valueType === 'Number';
    case '$regex':
    case '$regexp':
      return includes(['RegExp', 'String'], valueType);
    case '$like':
    case '$likeI':
      return valueType === 'String';
    case '$between':
    case '$mod':
      return valueType === 'Array' && value.length === 2;
    case '$cb':
      return valueType === 'Function';
    default:
      return true;
  }
};

const testModelAttribute = function(queryType, value) {
  const valueType = utils.getType(value);

  switch (queryType) {
    case '$like':
    case '$likeI':
    case '$regex':
    case '$startsWith':
    case '$endsWith':
      return valueType === 'String';
    case '$contains':
    case '$all':
    case '$any':
    case '$elemMatch':
      return valueType === 'Array';
    case '$size':
      return includes(['String', 'Array'], valueType);
    case '$in':
    case '$nin':
      return value != null;
    default:
      return true;
  }
};

const performQuery = function(type, value, attr, model, getter) {
  switch (type) {
    case '$and':
    case '$or':
    case '$nor':
    case '$not':
      return performQuerySingle(type, value, getter, model);
    case '$cb':
      return value.call(model, attr);
    case '$elemMatch':
      return runQuery(attr, value, null, true);
  }

  if (typeof value === 'function') {
    value = value();
  }

  switch (type) {
    case '$equal':
      if (isArray(attr)) {
        return includes(attr, value);
      }

      return attr === value;
    case '$deepEqual':
      return isEqual(attr, value);
    case '$ne':
      return attr !== value;
    case '$type':
      return typeof attr === value;
    case '$lt':
      return value != null && attr < value;
    case '$gt':
      return value != null && attr > value;
    case '$lte':
      return value != null && attr <= value;
    case '$gte':
      return value != null && attr >= value;
    case '$between':
      return (
        value[0] != null &&
        value[1] != null &&
        value[0] < attr &&
        attr < value[1]
      );
    case '$betweene':
      return (
        value[0] != null &&
        value[1] != null &&
        value[0] <= attr &&
        attr <= value[1]
      );
    case '$size':
      return attr.length === value;
    case '$exists':
    case '$has':
      return (attr != null) === value;
    case '$contains':
      return includes(attr, value);
    case '$in':
      return includes(value, attr);
    case '$nin':
      return !includes(value, attr);
    case '$all':
      return every(value, item => includes(attr, item));
    case '$any':
      return some(attr, item => includes(value, item));
    case '$none':
      return !some(attr, item => includes(value, item));
    case '$like':
      return attr.indexOf(value) !== -1;
    case '$likeI':
      return attr.toLowerCase().indexOf(value) !== -1;
    case '$startsWith':
      return attr.toLowerCase().indexOf(value) === 0;
    case '$endsWith':
      return utils.reverseString(attr).indexOf(value) === 0;
    case '$regex':
    case '$regexp':
      return value.test(attr);
    case '$mod':
      return attr % value[0] === value[1];
    default:
      return false;
  }
};

const single = function(queries, getter, isScore) {
  let queryObj;

  if (getter) {
    getter = parseGetter(getter);
  }

  if (isScore) {
    if (queries.length !== 1) {
      throw new Error(
        "score operations currently don't work on compound queries",
      );
    }

    queryObj = queries[0];

    if (queryObj.type !== '$and') {
      throw new Error(
        'score operations only work on $and queries (not ' + queryObj.type,
      );
    }

    return model =>
      Object.assign(model, {
        _score: performQuerySingle(
          queryObj.type,
          queryObj.parsedQuery,
          getter,
          model,
          true,
        ),
      });
  } else {
    return model => {
      return (queries || []).every(queryObj =>
        performQuerySingle(
          queryObj.type,
          queryObj.parsedQuery,
          getter,
          model,
          isScore,
        ),
      );
    };
  }
};

const performQuerySingle = function(type, query, getter, model, isScore) {
  const scoreInc = 1 / query.length;
  let passes = 0;
  let score = 0;

  let attr;
  let test;
  let boost;

  for (let q of query) {
    if (getter) {
      attr = getter(model, q.key);
    } else if (q.getter) {
      attr = q.getter(model, q.key);
    } else {
      attr = model[q.key];
    }

    test = testModelAttribute(q.type, attr);

    if (test) {
      if (q.parsedQuery) {
        test = single([q], getter, isScore)(model);
      } else {
        test = performQuery(q.type, q.value, attr, model, getter);
      }
    }

    if (test) {
      passes++;
      if (isScore) {
        boost = q.boost != null ? q.boost : 1;
        score += scoreInc * boost;
      }
    }

    switch (type) {
      case '$and':
        if (!(isScore || test)) {
          return false;
        }
        break;
      case '$not':
        if (test) {
          return false;
        }
        break;
      case '$or':
        if (test) {
          return true;
        }
        break;
      case '$nor':
        if (test) {
          return false;
        }
        break;
      default:
        throw new Error('Invalid compound method');
    }
  }

  if (isScore) {
    return score;
  } else if (type === '$not') {
    return passes === 0;
  } else {
    return type !== '$or';
  }
};

const parseQuery = function(query) {
  const queryKeys = keys(query);

  if (!queryKeys.length) {
    return [];
  }

  const compoundQuery = intersection(utils.compoundKeys, queryKeys);

  for (let type of compoundQuery) {
    if (!isArray(query[type]) && includes(utils.expectedArrayQueries, type)) {
      throw new Error(type + ' query must be an array');
    }
  }

  if (compoundQuery.length === 0) {
    return [
      {
        type: '$and',
        parsedQuery: parseSubQuery(query),
      },
    ];
  } else if (compoundQuery.length !== queryKeys.length) {
    if (!includes(compoundQuery, '$and')) {
      query.$and = {};
      compoundQuery.unshift('$and');
    }

    let val;
    for (let key in query) {
      if (!Object.prototype.hasOwnProperty.call(query, key)) {
        continue;
      }

      if (includes(utils.compoundKeys, key)) {
        continue;
      }

      val = query[key];
      query.$and[key] = val;

      delete query[key];
    }
  }

  return (compoundQuery || []).map(type => ({
    type: type,
    parsedQuery: parseSubQuery(query[type], type),
  }));
};

const parseGetter = function(getter) {
  if (typeof getter === 'string') {
    return (obj, key) => obj[getter](key);
  } else {
    return getter;
  }
};

const buildQuery = (items, getter) =>
  new QueryBuilder(items, getter, runQuery, makeTest);

const makeTest = (query, getter) =>
  single(parseQuery(query), parseGetter(getter));

const findOne = (items, query, getter) => runQuery(items, query, getter, true);

const score = (items, query, getter) =>
  runQuery(items, query, getter, false, true);

export const runQuery = function(items, query, getter, first, isScore) {
  let fn;

  if (arguments.length < 2) {
    return buildQuery.apply(this, arguments);
  }

  if (getter) {
    getter = parseGetter(getter);
  }

  if (!(utils.getType(query) === 'Function')) {
    query = single(parseQuery(query), getter, isScore);
  }

  if (isScore) {
    fn = map;
  } else if (first) {
    fn = find;
  } else {
    fn = filter;
  }

  return fn(items, query);
};

runQuery.build = buildQuery;

runQuery.parse = parseQuery;

runQuery.findOne = runQuery.first = findOne;

runQuery.score = score;

runQuery.tester = runQuery.testWith = makeTest;

runQuery.getter = runQuery.pluckWith = utils.makeGetter(lookup);
