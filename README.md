# gyp-parser

GYP file format parser in JS

```js
import { parse } from 'gyp-parser';

parse(gypFileSource);

// e.g.

parse("{ 'variable': [ 'array' ] }")
  // -> { variable: [ 'array' ] }
```

`eval()` works most of the time as well, but does not support fancier features
like implicit string concatenation.

This package is exclusively a parser and does not perform any I/O.

## LICENSE

MIT
