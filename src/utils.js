export const compoundKeys = ['$and', '$not', '$or', '$nor'];
export const expectedArrayQueries = ['$and', '$or', '$nor'];
export const tagSortOrder = [
  '$lt',
  '$lte',
  '$gt',
  '$gte',
  '$exists',
  '$has',
  '$type',
  '$ne',
  '$equal',
  '$mod',
  '$size',
  '$between',
  '$betweene',
  '$startsWith',
  '$endsWith',
  '$like',
  '$likeI',
  '$contains',
  '$in',
  '$nin',
  '$all',
  '$any',
  '$none',
  '$cb',
  '$regex',
  '$regexp',
  '$deepEqual',
  '$elemMatch',
  '$not',
  '$and',
  '$or',
  '$nor',
];

export const getType = obj => {
  const type = Object.prototype.toString.call(obj).substr(8);

  return type.substr(0, type.length - 1);
};

export const makeObj = (key, val) => {
  return {
    [key]: val,
  };
};

export const reverseString = str => {
  return str
    .toLowerCase()
    .split('')
    .reverse()
    .join('');
};

export const makeGetter = lookup => keys => {
  keys = keys.split('.');

  return obj => lookup(keys, obj);
};
