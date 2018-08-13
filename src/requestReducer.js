import { fromJS } from 'immutable';

/**
 * Reducer for tracking requests. Stores requests in an Immutable object
 *
 * @param      {Immutable.Map}  state   The state
 * @param      {object}  action  The redux action
 * @return     {Immutable.Map}  Modified state
 */
const requestsReducer = (state = fromJS({}), action) => {
  const types = ['REQUEST', 'SUCCESS', 'FAILURE'].map(t => `RECORD_${t}`);

  if (types.indexOf(action.type) === -1) {
    return state;
  }

  const event = action.type.split('_')[1];

  let newState = state;

  // Clear old history by default on SUCCESS/FAILURE
  if (event !== 'REQUEST' && action.clearHistory) {
    newState = newState.delete(action.url);
  }

  return newState.setIn([action.url, action.method, event], action.time);
};

export default requestsReducer;
