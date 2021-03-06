/**
 * MIT License
 *
 * Copyright (c) 2017-present, Elasticsearch BV
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

const { verifyNoBrowserErrors } = require('../../../../../dev-utils/webdriver')

describe('manual-timing', function() {
  it('should run manual timing', function() {
    browser.timeouts('script', 10000)
    browser.url('/test/e2e/manual-timing/index.html')

    browser.waitUntil(
      function() {
        return browser.getText('#test-element') === 'Passed'
      },
      5000,
      'expected element #test-element'
    )

    var result = browser.executeAsync(function(done) {
      var apmServerMock = window.elasticApm.serviceFactory.getService(
        'ApmServer'
      )

      function checkCalls() {
        var serverCalls = apmServerMock.calls
        var validCalls =
          serverCalls.sendErrors &&
          serverCalls.sendErrors.length &&
          serverCalls.sendTransactions &&
          serverCalls.sendTransactions.length
        if (validCalls) {
          console.log('calls', serverCalls)
          Promise.all([
            serverCalls.sendErrors[0].returnValue,
            serverCalls.sendTransactions[0].returnValue
          ])
            .then(function() {
              function mapCall(c) {
                return { args: c.args, mocked: c.mocked }
              }
              try {
                var calls = {
                  sendErrors: serverCalls.sendErrors.map(mapCall),
                  sendTransactions: serverCalls.sendTransactions.map(mapCall)
                }
                done(calls)
              } catch (e) {
                throw e
              }
            })
            .catch(function(reason) {
              console.log('reason', reason)
              try {
                done({ error: reason.message || JSON.stringify(reason) })
              } catch (e) {
                done({
                  error: 'Failed serializing rejection reason: ' + e.message
                })
              }
            })
        }
      }

      checkCalls()
      apmServerMock.subscription.subscribe(checkCalls)
    })

    expect(result.value).toBeTruthy()
    var serverCalls = result.value
    console.log(JSON.stringify(serverCalls, null, 2))
    if (serverCalls.error) {
      fail(serverCalls.error)
    }
    expect(serverCalls.sendErrors.length).toBe(1)
    var errorPayload = serverCalls.sendErrors[0].args[0][0]
    expect(
      errorPayload.exception.message.indexOf('timeout test error') >= 0
    ).toBeTruthy()

    expect(serverCalls.sendTransactions.length).toBe(1)
    var transactionPayload = serverCalls.sendTransactions[0].args[0][0]
    expect(transactionPayload.name).toBe('transaction-name')
    expect(transactionPayload.type).toBe('transaction-type')

    return verifyNoBrowserErrors()
  })
})
