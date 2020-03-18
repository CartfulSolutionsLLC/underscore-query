# Requires

assert = require "assert"
_ = require "lodash"
query = require("../dist/json-query").runQuery

suite = require "./suite"

describe "Underscore Query Tests", ->
  suite(query)
