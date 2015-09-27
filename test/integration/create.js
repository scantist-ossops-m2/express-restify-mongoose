var assert = require('assert')
var mongoose = require('mongoose')
var request = require('request')
var util = require('util')

module.exports = function (createFn) {
  var erm = require('../../lib/express-restify-mongoose')
  var db = require('./setup')()

  var testPort = 30023
  var testUrl = 'http://localhost:' + testPort
  var invalidId = 'invalid-id'
  var randomId = mongoose.Types.ObjectId().toHexString()

  function setup (callback) {
    db.initialize(function (err) {
      if (err) {
        return callback(err)
      }

      db.reset(callback)
    })
  }

  function dismantle (app, server, callback) {
    db.close(function (err) {
      if (err) {
        return callback(err)
      }

      if (app.close) {
        return app.close(callback)
      }

      server.close(callback)
    })
  }

  describe('Create documents', function () {
    var app = createFn()
    var server
    var customer, product

    beforeEach(function (done) {
      setup(function (err) {
        if (err) {
          return done(err)
        }

        erm.serve(app, db.models.Customer, {
          restify: app.isRestify
        })

        erm.serve(app, db.models.Invoice, {
          restify: app.isRestify
        })

        erm.serve(app, db.models.Product, {
          restify: app.isRestify
        })

        db.models.Customer.create({
          name: 'William'
        }).then(function (createdCustomer) {
          customer = createdCustomer

          return db.models.Product.create({
            name: 'William'
          })
        }).then(function (createdProduct) {
          product = createdProduct
          server = app.listen(testPort, done)
        }, function (err) {
          done(err)
        })
      })
    })

    afterEach(function (done) {
      dismantle(app, server, done)
    })

    it('POST /Customers 201', function (done) {
      request.post({
        url: util.format('%s/api/v1/Customers', testUrl),
        json: {
          name: 'John'
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(body._id)
        assert.equal(body.name, 'John')
        done()
      })
    })

    it('POST /Customers 201 - ignore _id', function (done) {
      request.post({
        url: util.format('%s/api/v1/Customers', testUrl),
        json: {
          _id: randomId,
          name: 'John'
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(body._id)
        assert.ok(body._id !== randomId)
        assert.equal(body.name, 'John')
        done()
      })
    })

    it('POST /Customers 201 - ignore __v', function (done) {
      request.post({
        url: util.format('%s/api/v1/Customers', testUrl),
        json: {
          __v: '1',
          name: 'John'
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(body._id)
        assert.ok(body.__v === 0)
        assert.equal(body.name, 'John')
        done()
      })
    })

    it('POST /Customers 201 - array', function (done) {
      request.post({
        url: util.format('%s/api/v1/Customers', testUrl),
        json: [{
          name: 'John'
        }, {
          name: 'Mike'
        }]
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(Array.isArray(body))
        assert.ok(body.length, 2)
        assert.ok(body[0]._id)
        assert.equal(body[0].name, 'John')
        assert.ok(body[1]._id)
        assert.equal(body[1].name, 'Mike')
        done()
      })
    })

    it('POST /Customers 400 - empty body', function (done) {
      request.post({
        url: util.format('%s/api/v1/Customers', testUrl),
        json: true
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 400)
        done()
      })
    })

    it('POST /Invoices 201 - referencing customer and products ids', function (done) {
      request.post({
        url: util.format('%s/api/v1/Invoices', testUrl),
        json: {
          customer: customer._id,
          products: [product._id, product._id],
          amount: 42
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(body._id)
        assert.equal(body.customer, customer._id)
        assert.equal(body.amount, 42)
        done()
      })
    })

    it('POST /Invoices 201 - referencing customer and products', function (done) {
      request.post({
        url: util.format('%s/api/v1/Invoices', testUrl),
        json: {
          customer: customer,
          products: [product, product],
          amount: 42
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 201)
        assert.ok(body._id)
        assert.equal(body.customer, customer._id)
        assert.equal(body.amount, 42)
        done()
      })
    })

    it('POST /Invoices 400 - referencing invalid customer and products ids', function (done) {
      request.post({
        url: util.format('%s/api/v1/Invoices', testUrl),
        json: {
          customer: invalidId,
          products: [invalidId, invalidId],
          amount: 42
        }
      }, function (err, res, body) {
        assert.ok(!err)
        assert.equal(res.statusCode, 400)
        assert.equal(body.name, 'ValidationError')
        done()
      })
    })
  })
}
