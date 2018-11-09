// Converts offline argument (likely a string, from process.env) to a format interpretable by the handler.
// The result determines both whether the requester should request on/offline **and**,
// if offline, how long (in milliseconds) the "request" should delay before resolving.
//
// Because a common pattern is to draw this offline value from process.env, which is typically
// an object with string values, where possible, the `parseOfflineArg` func converts values from strings.
// Handlers accept only numbers, false, undefined, and null as arguments.
// So this function converts:
// - The boolean true or string 'true' to 0.
// - Other strings to their number version (eg '5' to 5), or to false, if number conversion fails.
// - any other value to false
//
// Post conversion, values will be handled like so:
// - Any number (0 included) will make the request *offline*, and delay it by the specified
//   number of milliseconds.
// - Any non-numerical value will make requests *online*.
export default const parseOfflineArg = arg => {
  if (value === 'true') {
    return 0;
  } else if (value === true) {
    return 0;
  } else if (typeof value === 'string') {
    const number = Number(value);
    return isNaN(number) ? false : number;
  } else {
    return false;
  }
};
