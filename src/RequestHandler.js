import actionsDefault from './actions';

const findDefault = type => (requestHistory, requestOptions) =>
  requestHistory.getIn([
    requestOptions.path,
    requestOptions.method,
    type.toUpperCase()
  ]);

/**
 * Generates req and reqOnce functions, which make and track requests.
 * Using this request handler, requests are automatically tracked, and can easily be
 * shifted offline.
 *
 * @class      RequestHandler
 */
class RequestHandler {
  //*
   * @param {[object]} apis                               Array of objects describing API responses. See README for details.
   * @param {[function]}  [requestFunction=fetch]         Function called to make (online) requests. Passed path etc from relevant API object.
   * @param {*} [offlineDelayTime=false]                  If a number, a string of a number, or the Boolean `true` (which translates here to `0`),
   *                                                      the request will be made "offline", with the specified delay. Otherwise, the request will be
   *                                                      made online (normally).
   * @param {Object}  [actions=actionsDefault]            Object with `recordRequest`, `recordSuccess`, and `recordFailure` functions, called appropriately
   *                                                      as part of the request lifecycle. Defaults to actions given by this package.
   * @param {String}  [requestHistoryStateKey='requests'] The Redux state key under which the requests are stored/tracked. Defaults to `'requests'`.
   * @param {Object}  [finders={}]                        Object of functions used to find previous request history in Redux store.
   */
  constructor (
    apis,
    requestFunction = fetch,
    offlineDelayTime = false,
    actions = actionsDefault,
    requestHistoryStateKey = 'requests',
    finders = {}
  ) {
    this.apis = apis;
    this.record = (path) => ({
      request: () => actions.recordRequest(path.path, path.method),
      success: () => actions.recordSuccess(path.path, path.method),
      failure: () => actions.recordFailure(path.path, path.method)
    });

    this.requestHistoryStateKey = requestHistoryStateKey;
    this.request = requestFunction;
    this.offline = this._parseOfflineValue(offlineDelayTime);

    this.req = this.req.bind(this);
    this.reqOnce = this.reqOnce.bind(this);
    this.finders = this._defineFinders(finders);
  }

  _isOffline() {
    return typeof this.offline === 'number';
  }

  _parseOfflineValue(value) {
    if (value === 'false') {
      return false;
    } else if (value === 'true') {
      return 0;
    } else if (typeof value === 'string') {
      return Number(value);
    } else if (value === true) {
      return 0;
    } else {
      return value;
    }
  }

  req(apiName, ...args) {
    const thunk = (dispatch, getState) => {
      const api = this._getAPI(apiName, ...args);
      return this._handleRequest(api, dispatch, getState);
    };

    return thunk.bind(this);
  }

  reqOnce(apiName, ...args) {
    const thunk = (dispatch, getState) => {
      const api = this._getAPI(apiName, ...args);
      const tracker = this._generateTracker(getState().requests)(api.path());

      if (tracker.any()) {
        return new Promise(resolve => resolve({}));
      } else {
        return this._handleRequest(api, dispatch, getState);
      }
    };

    return thunk.bind(this);
  }

  // PRIVATE

  _generateTracker(requestHistory, finders = {}) {
    return requestOptions => {
      const { findRequest, findSuccess, findFailure } = this.finders;
      return {
        succeeded: () => findSuccess(requestHistory, requestOptions),
        failed: () => findFailure(requestHistory, requestOptions),
        requested: () => findRequest(requestHistory, requestOptions),
        any: () =>
          [findRequest, findSuccess, findFailure].some(finder =>
            finder(requestHistory, requestOptions)
          )
      };
    };
  }

  _defineFinders(finders) {
    const findRequest = finders.findRequest || (finders.findDefault || findDefault)('request');
    const findSuccess = finders.findSuccess || (finders.findDefault || findDefault)('success');
    const findFailure = finders.findFailure || (finders.findDefault || findDefault)('failure');
    return { findRequest, findSuccess, findFailure };
  }

  _handleRequest (api, dispatch, getState) {
    const pathObj = api.path();
    const record = this.record(pathObj);

    const makeRequest = this._isOffline()
      ? () =>
        new Promise(resolve => {
          const offlineFunc = api.offlineResponse;
          if (!offlineFunc) {
            throw new Error(
              `No offline function defined for API ${api.name}:`
            );
          }

          // If offline, delay by given delay time
          setTimeout(() => {
            const response = offlineFunc(getState);
            resolve(response);
          }, this.offline);
        })
      : this.request;

    dispatch(record.request());
    return new Promise((resolve, reject) => {
      makeRequest(pathObj)
        .then(response => {
          dispatch(record.success());
          api.onSuccess && api.onSuccess(response, dispatch);
          resolve(response);
        })
        .catch(err => {
          dispatch(record.failure());

          if (api.onFailure) {
            api.onFailure(err, dispatch);
          } else {
            // eslint-disable-next-line
            console.error(err);
          }

          reject(err);
        });
    });
  }

  _getAPI(name, ...args) {
    const apiFunc = this.apis[name];

    if (!apiFunc) {
      throw new Error(`No api object found with name: ${name}`);
    }

    const api = apiFunc(...args);
    api.name = name;

    return api;
  }
}

export default RequestHandler;
