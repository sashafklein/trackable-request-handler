# Trackable Request Handler

This module provides some tools for making requests that are:

1. Easy to track,
2. Easy to throttle or make only once,
3. Easy to switch to offline requests.

It is designed to be ambivalent to the method of request. So `axios`, `fetch`, `Amplify.get` etc should all work, with slight configuration.

### Getting Started

This module assumes you are using `redux` and `redux-thunk`.

###### Install the module

```
yarn add trackable-request-handler
```

###### Define an APIs object

The module expects an APIs object where each key points to a function which takes request arguments and returns an object with 3 methods:

1. `path` -- Returns the path information associated with the request.
2. `offlineResponse` -- Given a Redux `getState` arg, responds with how a successful response should look, given the args. (When offline, this stubs the request and returns the function results.)
3. `onSuccess` -- Given two args (`response`, and Redux `dispatch`), called on a successful API hit.

An example APIs file:

```
const updateUser = (id, updates) => ({
  path: () => ({ method: 'PUT', path: `/users/${id}`, body: updates }),
  offlineResponse: (getState) => ({
    id,
    ...updates,
    updatedAt: new Date().toISOString()
  }),
  onSuccess: (response, dispatch) => {
    console.log('Data', response);
    dispatch(receiveUser(id, response));
  }
});

// ...

export const apis = { getUser, /* ...and more */ }
```

In the above example, the `offlineResponse` method returns the ideal API response for a successful `PUT`, and the `onSuccess` function will be passed that response and dispatch it to the Redux store (once the rest is hooked up).


###### Add the requestsReducer

The module allows you to define precisely how you track requests, but it also provides a simple default, the `requestsReducer` export. Add this to your reducers to get going:

```
export const store = combineReducers({
  requests: requestsReducer,
  // Etc
});
```

###### Configure the handler

Finally, create a util file (named, say, `request.js`), and use it to configure your handler and export its core functions, `req`, and `reqOnce`.

Here's a simple example configuration, using `aws-amplify` as the underlying request function, and the example `apis` object above:

> Note. The requestFunction you supply must have a basic fetch-like signature, taking a single `options` object argument, from which it constructs the request. And it must return the request Promise.

```
import RequestHandler from 'trackable-request-handler';
import { API } from 'aws-amplify';

import { apis } from './apis';

// ENV variable which switches the requester to offline
const { REACT_APP_OFFLINE } = process.env;

// Define a fetch-like request function
async function awsRequest({
  path,
  method = 'GET',
  queryParams = {},
  body,
  headers = {
    'Content-Type': 'application/json'
  }
}) {
  const options = { queryParams, headers };

  if (method !== 'GET' && body) {
    options.body = body;
  }

  // AWS Amplify's functions are API.get, API.put, API.post, and API.del
  // Whereas our methods are GET, PUT, POST, and DELETE
  const awsMethod = ({ DELETE: 'DEL' }[method] || method).toLowerCase();

  return API[awsMethod]('my-aws-api-name', path, options);
}

// Generate a new handler using the request function
const handler = new RequestHandler(APIs, awsRequest, REACT_APP_OFFLINE);

// Export the two handler functions, for use in components

/**
 * Function. Takes an API name and args, and makes and tracks the request
 */
export const req = handler.req;

/**
 * Function. Takes an API name and args, and makes the request *only* if it
 * has not been made before. Tracks the request.
 */
export const reqOnce = handler.reqOnce;
```


### Usage

Once you've defined your handler and exported the `req` and `reqOnce` functions, you can use them like thunks throughout the application. Simply feed `req` and `reqOnce` the name of the API you wish to call, and any additional arguments, and `dispatch` it.

###### req

Here's a basic example, using the above `updateUser` API, in a component:

```
import { req } from 'utils/request';
/...
  updateUser () {
    const { dispatch } = this.props;
    const { userAttrs } = this.state;

    dispatch(req('updateUser', userAttrs))
      .then(() => { // Called after above-defined onSuccess
        this.setState({ editable: false });
      })
  }
```

###### reqOnce

Similarly, you could use `reqOnce` to, for example, grab relevant data on page load. Because the request is tracked, `reqOnce` will insure that it is only made once (unless unsuccessful), however many times you return to the page (until the app is refreshed and the Redux store cleared).


### Configuration

The `RequestHandler` takes a number of configuration arguments, which all (other than the APIs object) have defaults:

- `apis` (object)_- Above-described object. No default provided.
- `requestFunction` (function) - Called to make the actual request. Defaults to `fetch`.
- `offline` (bool) - Whether the app is "offline" and should reach for `offlineResponse` stubbed results, instead of making requests. Deafault: false.
- `actions` (object) - Object defining Redux action functions to `recordRequest`, `recordSuccess` and `recordFailure`. The defaults correspond to the default reducer provided. Alternate actions can be provided to correspond to different request reducers.
- `requestHistoryStateKey` (string) - The key under which the request history is stored in the Redux store (above, 'requests'). Default: 'requests'
- `finders` (object) - Object defining functions which take two arguments, 1) the request history reducer, and 2) the request object (eg `{ method: 'PUT', path: '/users/1' }`) to determine the location of the tracked request in the request history reducer. Expecting `findRequest`, `findSuccess`, and `findFailure` to be defined. Defaults are provided which correspond to the default reducer.

### Multiple APIs

The tool can be used with multiple APIs, by defining a handler for each:

```
const awsHandler = new RequestHandler(APIs, awsRequest, REACT_APP_OFFLINE);
const normalHandler = new RequestHandler(APIs, fetch, REACT_APP_OFFLINE);

export const normalReq = normalHandler.req;
// Etc
```