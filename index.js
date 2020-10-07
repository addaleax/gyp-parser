'use strict';
class ParseError extends Error {
  constructor(input, at, message) {
    const before = input.slice(Math.max(at - 6, 0), Math.min(input.length, at));
    const exact = input[at];
    const after = input.slice(Math.min(input.length, at + 1), Math.min(input.length, at + 6));
    const source = `${before}<${exact}>${after}`;
    super(`${message} around position ${at} (${source})`);
  }
}

function parseGYP(input) {
  const [ err, value ] = parseElement(input, 0);
  if (err) throw err;
  return value;
}

function discardWhitespace(input, at) {
  while (at < input.length && input[at].trim() === '') at++;
  if (input[at] === '#') {
    while (at < input.length && input[at] !== '\n') at++;
    return discardWhitespace(input, at);
  }
  return at;
}

function parseValue(input, at) {
  at = discardWhitespace(input, at);

  let attempt = [];
  switch (input[at]) {
    case '{': return parseObject(input, at);
    case '[': return parseArray(input, at);
    case '"':
    case "'": return parseString(input, at);
    case 't': return parseTrue(input, at);
    case 'f': return parseFalse(input, at);
    case 'n': return parseNull(input, at);
    case '-':
    case '+': return parseNumber(input, at);
    default:
      if (input.codePointAt(at) >= 0x30 && input.codePointAt(at) <= 0x39)
        return parseNumber(input, at);
  }

  return [ new ParseError(input, at, 'Unexpected token') ];
}

function parseTrue(input, at) {
  if (input.slice(at, at + 4) === 'true')
    return [ null, true, at + 4 ];
  return [ new ParseError(input, at, 'Expected "true"') ];
}

function parseFalse(input, at) {
  if (input.slice(at, at + 5) === 'false')
    return [ null, false, at + 5 ];
  return [ new ParseError(input, at, 'Expected "false"') ];
}

function parseNull(input, at) {
  if (input.slice(at, at + 4) === 'null')
    return [ null, null, at + 4 ];
  return [ new ParseError(input, at, 'Expected "null"') ];
}

function parseObject(input, at) {
  if (input[at] !== '{')
    return [ new ParseError(input, at, 'Expected "{"') ];
  at++;
  at = discardWhitespace(input, at);
  if (input[at] === '}')
    return [ null, {}, at + 1 ];
  const [ err, members, newAt ] = parseMembers(input, at);
  if (err) return [ err ];
  if (input[newAt] !== '}')
    return [ new ParseError(input, at, 'Expected "}"') ];
  return [ err, ObjectFromEntries(members), newAt + 1 ];
}

function ObjectFromEntries(entries) {
  const ret = {};
  for (const [ key, value ] of entries)
    ret[key] = value;
  return ret;
}

function parseMembers(input, at) {
  if (input[at] === ',')
    return [ new ParseError(input, at, 'Unexpected ","') ];
  const members = [];
  while (input[at] !== '}') {
    let [ err, member, newAt ] = parseMember(input, at);
    if (err) return [ err ];
    at = newAt;
    members.push(member);
    if (at >= input.length)
      return [ new ParseError(input, at, 'Unexpected end of input') ];
    at = discardWhitespace(input, at);
    if (input[at] === '}') break;
    if (input[at] !== ',')
      return [ new ParseError(input, at, 'Expected "," or "}"') ];
    at++;
    at = discardWhitespace(input, at);
  }
  return [ null, members, at ];
}

function parseMember(input, at) {
  at = discardWhitespace(input, at);
  const member = [ null, null ];

  {
    const [ err, key, newAt ] = parseString(input, at);
    if (err) return [ err ];
    at = newAt;
    member[0] = key;
  }
  at = discardWhitespace(input, at);
  if (input[at] !== ':')
    return [ new ParseError(input, at, 'Expected ":"') ];
  at++;
  {
    const [ err, element, newAt ] = parseElement(input, at);
    if (err) return [ err ];
    at = newAt;
    member[1] = element;
  }
  return [ null, member, at ];
}

function parseArray(input, at) {
  if (input[at] !== '[')
    return [ new ParseError(input, at, 'Expected "["') ];
  at++;
  at = discardWhitespace(input, at);
  if (input[at] === ']')
    return [ null, [], at + 1 ];
  const [ err, elements, newAt ] = parseElements(input, at);
  if (err) return [ err ];
  if (input[newAt] !== ']')
    return [ new ParseError(input, at, 'Expected "]"') ];
  return [ err, elements, newAt + 1 ];
}

function parseElements(input, at) {
  if (input[at] === ',')
    return [ new ParseError(input, at, 'Unexpected ","') ];
  const elements = [];
  while (input[at] !== ']') {
    let [ err, element, newAt ] = parseElement(input, at);
    if (err) return [ err ];
    at = newAt;
    elements.push(element);
    if (at >= input.length)
      return [ new ParseError(input, at, 'Unexpected end of input') ];
    at = discardWhitespace(input, at);
    if (input[at] === ']') break;
    if (input[at] !== ',')
      return [ new ParseError(input, at, 'Expected "," or "]"') ];
    at++;
    at = discardWhitespace(input, at);
  }
  return [ null, elements, at ];
}

function parseElement(input, at) {
  at = discardWhitespace(input, at);
  const [ err, value, newAt ] = parseValue(input, at);
  at = newAt;
  at = discardWhitespace(input, at);
  return [ err, value, at ];
}

function parseString(input, at) {
  if (input[at] !== '"' && input[at] !== "'")
    return [ new ParseError(input, at, 'Expected \' or "') ];
  const type = input[at++];
  let value = '';
  while (input[at] !== type) {
    if (input[at] === '\\') {
      switch (input[++at]) {
        case '"':
        case "'":
        case '\\':
        case '/':
          value += input[at++];
          break;
        case 'b': value += '\b'; at++; break;
        case 'f': value += '\f'; at++; break;
        case 'n': value += '\n'; at++; break;
        case 'r': value += '\r'; at++; break;
        case 't': value += '\t'; at++; break;
        case 'u': {
          at++;
          const hexString = input.slice(at, at + 4);
          if (!/^[0-9A-Fa-f]+$/.test(hexString))
            return [ new ParseError(input, at, 'Invalid hex escape') ];
          value += String.fromCodePoint(parseInt(hexString, 16));
          at += 4;
          break;
        }
        case 'x': {
          at++;
          const hexString = input.slice(at, at + 2);
          if (!/^[0-9A-Fa-f]+$/.test(hexString))
            return [ new ParseError(input, at, 'Invalid hex escape') ];
          value += String.fromCodePoint(parseInt(hexString, 16));
          at += 2;
          break;
        } default:
          return [ new ParseError(input, at, 'Unknown escape character') ];
      }
    } else {
      value += input[at++];
    }

    if (at >= input.length)
      return [ new ParseError(input, at, 'Unexpected end of input') ];
  }
  at++;
  at = discardWhitespace(input, at);
  if (input[at] === '"' || input[at] === "'") {
    const [ err, more, newAt ] = parseString(input, at);
    if (err) return [ err ];
    return [ null, value + more, newAt ];
  }

  return [ null, value, at ];
}

function parseNumber(input, at) {
  if (input[at] === '+') at++;
  const m = input.slice(at).match(/^[-]?([1-9][0-9]+|[0-9])(\.[0-9]*)?([eE][+-][0-9]+)?/);
  if (!m) return [ new ParseError(input, at, 'Expected number') ];
  return [ null, JSON.parse(m[0]), at + m[0].length ];
}

exports.parse = parseGYP;
