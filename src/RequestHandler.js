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
  constructor (
    apis,
    requestFunction = fetch,
    offline = false,
    actions = actionsDefault,
    requestHistoryStateKey = 'requests',
    finders = {}
  ) {
    this.apis = apis;
    this.record = (api) => ({
      request: () => actions.recordRequest(api.path()),
      success: () => actions.recordSuccess(api.path()),
      failure: () => actions.recordFailure(api.path())
    });

    this.requestHistoryStateKey = requestHistoryStateKey;
    this.request = requestFunction;
    this.offline = offline;

    this.req = this.req.bind(this);
    this.reqOnce = this.reqOnce.bind(this);
    this.finders = this._defineFinders(finders);
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
    const record = this.record(api);
    const pathObj = api.path();
    const makeRequest = this.offline
      ? () =>
        new Promise(resolve => {
          const offlineFunc = api.offlineResponse;
          if (!offlineFunc) {
            throw new Error(
              `No offline function defined for API ${api.name}:`
            );
          }

          const response = offlineFunc(getState);
          resolve(response);
        })
      : this.request;

    dispatch(record.request());
    return makeRequest(pathObj)
      .then(response => {
        dispatch(record.success());
        api.onSuccess && api.onSuccess(response, dispatch);
        return response;
      })
      .catch(err => {
        dispatch(record.failure());
        // eslint-disable-next-line
        console.error(err);
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
