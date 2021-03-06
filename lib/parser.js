
/*!
 * Stylus - Parser
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var Lexer = require('./lexer')
  , nodes = require('./nodes')
  , inspect = require('sys').inspect;

/**
 * Selector composite tokens.
 */

var selectorTokens = [
    'ident'
  , 'string'
  , 'selector'
  , 'function'
  , 'comment'
  , 'space'
  , 'color'
  , 'unit'
  , 'for'
  , '['
  , ']'
  , '('
  , ')'
  , '+'
  , '-'
  , '*'
  , '<'
  , '>'
  , '='
  , ':'
  , '&'
  , '~'
];

/**
 * CSS3 pseudo-selectors.
 */

var pseudoSelectors = [
    'root'
  , 'nth-child'
  , 'nth-last-child'
  , 'nth-of-type'
  , 'nth-last-of-type'
  , 'first-child'
  , 'last-child'
  , 'first-of-type'
  , 'last-of-type'
  , 'only-child'
  , 'only-of-type'
  , 'empty'
  , 'link'
  , 'visited'
  , 'active'
  , 'hover'
  , 'focus'
  , 'target'
  , 'lang'
  , 'enabled'
  , 'disabled'
  , 'checked'
  , 'not'
];

/**
 * Initialize a new `Parser` with the given `str` and `options`.
 *
 * @param {String} str
 * @param {Object} options
 * @api private
 */

var Parser = module.exports = function Parser(str, options) {
  var self = this;
  options = options || {};
  this.str = nodes.source = str;
  this.lexer = new Lexer(str, options);
  this.root = options.root || new nodes.Root;
  this.state = ['root'];
  this.state.pop = function(){
    self.prevState = [].pop.call(this);
  };
};

/**
 * Parser prototype.
 */

Parser.prototype = {
  
  /**
   * Constructor.
   */
  
  constructor: Parser,
  
  /**
   * Return current state.
   *
   * @return {String}
   * @api private
   */
  
  get currentState() {
    return this.state[this.state.length - 1];
  },
  
  /**
   * Parse the input, then return the root node.
   *
   * @return {Node}
   * @api private
   */
  
  parse: function(){
    var block = this.parent = this.root;
    while ('eos' != this.peek.type) {
      if (this.accept('newline')) continue;
      var stmt = this.statement;
      this.accept(';');
      if (!stmt) this.error('unexpected token {peek}, not allowed at the root level');
      block.push(stmt);
    }
    return block;
  },
  
  /**
   * Throw an `Error` with the given `msg`.
   *
   * @param {String} msg
   * @api private
   */
  
  error: function(msg){
    var type = this.peek.type
      , val = undefined == this.peek.val
        ? ''
        : ' ' + this.peek.toString();
    if (val.trim() == type.trim()) val = '';
    throw new Error(msg.replace('{peek}', type + val));
  },
  
  /**
   * Accept the given token `type`, and return it,
   * otherwise return `undefined`.
   *
   * @param {String} type
   * @return {Token}
   * @api private
   */

  accept: function(type){
    if (type == this.peek.type) {
      return this.next;
    }
  },

  /**
   * Expect token `type` and return it, throw otherwise.
   *
   * @param {String} type
   * @return {Token}
   * @api private
   */

  expect: function(type){
    if (type != this.peek.type) {
      throw new Error('expected ' + type + ', got ' + this.peek);
    }
    return this.next;
  },
  
  /**
   * Get the next token.
   *
   * @return {Token}
   * @api private
   */
  
  get next() {
    var tok = this.lexer.next;
    nodes.lineno = tok.lineno;
    return tok;
  },
  
  /**
   * Peek with lookahead(1).
   *
   * @return {Token}
   * @api private
   */
  
  get peek() {
    return this.lexer.peek;
  },
  
  /**
   * Lookahead `n` tokens.
   *
   * @param {Number} n
   * @return {Token}
   * @api private
   */
  
  lookahead: function(n){
    return this.lexer.lookahead(n);
  },
  
  /**
   * Check if the token at `n` is a valid selector token. 
   *
   * @param {Number} n
   * @return {Boolean}
   * @api private
   */
  
  isSelectorToken: function(n) {
    var la = this.lookahead(n).type;
    switch (la) {
      case 'for':
        return this.bracketed;
      case '[':
        this.bracketed = true;
        return true;
      case ']':
        this.bracketed = false;
        return true;
      default:
        return ~selectorTokens.indexOf(la);
    }
  },
  
  /**
   * Check if the token at `n` is a pseudo selector.
   *
   * @param {Number} n
   * @return {Boolean}
   * @api private
   */
  
  isPseudoSelector: function(n){
    return ~pseudoSelectors.indexOf(this.lookahead(n).val.name);
  },
  
  /**
   * Valid selector tokens.
   */
  
  get selectorToken() {
    if (this.isSelectorToken(1)) return this.next;
  },
  
  /**
   * Consume whitespace.
   */

  get skipWhitespace() {
    while (~['space', 'indent', 'outdent', 'newline'].indexOf(this.peek.type))
      this.next;
  },

  /**
   * Consume spaces.
   */
  
  get skipSpaces() {
    while ('space' == this.peek.type)
      this.next;
  },
  
  /**
   * Check if the following sequence of tokens
   * forms a function definition, ie trailing
   * `{` or indentation.
   */

  looksLikeFunctionDefinition: function(i) {
    return 'indent' == this.lookahead(i).type
      || '{' == this.lookahead(i).type;
  },
  
  /**
   * Check if the following sequence of tokens
   * forms a selector.
   */
  
  get looksLikeSelector() {
    var i = 1;

    // Assume selector when an ident is
    // followed by a selector
    while ('ident' == this.lookahead(i).type
      && 'newline' == this.lookahead(i + 1).type) i += 2;

    // Assume pseudo selectors are NOT properties
    // as 'td:th-child(1)' may look like a property
    // and function call to the parser otherwise
    while (this.isSelectorToken(i)) {
      if (':' == this.lookahead(i++).type
        && this.isPseudoSelector(i))
        return true;
    }

    // Trailing comma
    if (',' == this.lookahead(i).type
      && 'newline' == this.lookahead(i + 1).type)
      return true;

    // Trailing brace
    if ('{' == this.lookahead(i).type
      && 'newline' == this.lookahead(i + 1).type)
      return true;

    // css-style mode, false on ; }
    if (this.css) {
      if (';' == this.lookahead(i) ||
          '}' == this.lookahead(i))
        return false;
    }

    // Trailing separators
    while (!~[
        'newline'
      , 'indent'
      , 'outdent'
      , 'for'
      , 'if'
      , ';'
      , '}'].indexOf(this.lookahead(i).type))
      ++i;

    if ('indent' == this.lookahead(i).type)
      return true;
  },
  
  /**
   *   statement
   * | statement 'if' expression
   * | statement 'unless' expression
   */
  
  get statement() {
    var op
      , stmt = this.stmt
      , state = this.prevState;

    // special-case statements since it
    // is not an expression. We could
    // implement postfix conditionals at
    // the expression level, however they
    // would then fail to enclose properties
    if (this.allowPostfix) {
      delete this.allowPostfix;
      state = 'expression';
    }

    switch (state) {
      case 'assignment':
      case 'expression':
      case 'function arguments':
        if (op = this.accept('if') || this.accept('unless')) {
          stmt = new nodes.If(this.expression, stmt);
          stmt.negate = 'unless' == op.type;
          this.accept(';');
        }
    }

    return stmt;
  },
  
  /**
   *    ident
   *  | selector
   *  | literal
   *  | charset
   *  | import
   *  | media
   *  | keyframes
   *  | page
   *  | for
   *  | if
   *  | unless
   *  | expression
   *  | 'return' expression
   */
  
  get stmt() {
    var type = this.peek.type;
    switch (type) {
      case 'selector':
      case 'literal':
      case 'keyframes':
      case 'charset':
      case 'import':
      case 'media':
      case 'page':
      case 'ident':
      case 'unless':
      case 'function':
      case 'for':
      case 'if':
        return this[type];
      case 'return':
        return this.return;
      case '{':
        return this.property;
      default:
        // Contextual selectors
        switch (this.currentState) {
          case 'root':
          case 'selector':
          case 'conditional':
          case 'keyframe':
          case 'function':
          case 'media':
          case 'for':
            switch (type) {
              case 'color':
              case '~':
              case '+':
              case '>':
              case '<':
              case '*':
              case ':':
              case '&':
              case '[':
                return this.selector;
            }
        }

        // Expression fallback
        var expr = this.expression;
        if (expr.isEmpty) this.error('unexpected {peek}');
        return expr;
    }
  },
  
  /**
   * indent (!outdent)+ outdent
   */

  block: function(node, scope) {
    var delim
      , stmt
      , _ = this.css
      , block = this.parent = new nodes.Block(this.parent, node);

    if (false === scope) block.scope = false;

    // css-style
    if (this.css = this.accept('{')) {
      delim = '}';
      this.skipWhitespace;
    } else {
      delim = 'outdent';
      this.expect('indent');
    }

    while (delim != this.peek.type) {
      // css-style
      if (this.css) {
        if (this.accept('newline')) continue;
        stmt = this.statement;
        this.accept(';');
        this.skipWhitespace;
      } else {
        if (this.accept('newline')) continue;
        stmt = this.statement;
      }
      if (!stmt) this.error('unexpected token {peek} in block');
      block.push(stmt);
    }

    // css-style
    if (this.css) {
      this.skipWhitespace;
      this.expect('}');
      this.skipSpaces;
      this.css = _;
    } else {
      this.expect('outdent');
    }

    this.parent = block.parent;
    return block;
  },
  
  /**
   * for val (',' key) in expr
   */
  
  get for() {
    this.expect('for');
    var key
      , val = this.id.name;
    if (this.accept(',')) key = this.id.name;
    this.expect('in');
    var each = new nodes.Each(val, key, this.expression);
    this.state.push('for');
    each.block = this.block(each);
    this.state.pop();
    return each;
  },
  
  /**
   * return expression
   */
  
  get return() {
    this.expect('return');
    var expr = this.expression;
    return expr.isEmpty
      ? new nodes.Return
      : new nodes.Return(expr);
  },
  
  /**
   * unless expression block
   */
  
  get unless() {
    this.expect('unless');
    var node = new nodes.If(this.expression, true);
    this.state.push('conditional');
    node.block = this.block(node, false);
    this.state.pop();
    return node;
  },
  
  /**
   * if expression block (else block)?
   */

  get if() {
    this.expect('if');
    var node = new nodes.If(this.expression);
    this.state.push('conditional');
    node.block = this.block(node, false);
    while (this.accept('else')) {
      if (this.accept('if')) {
        var cond = this.expression
          , block = this.block(node, false);
        node.elses.push(new nodes.If(cond, block));
      } else {
        node.elses.push(this.block(node, false));
        break;
      }
    }
    this.state.pop();
    return node;
  },
  
  /**
   * media
   */
  
  get media() {
    var val = this.expect('media').val
      , media = new nodes.Media(val);
    this.state.push('media');
    media.block = this.block(media);
    this.state.pop();
    return media;
  },

  /**
   * import string
   */
   
  get import() {
    this.expect('import');
    this.allowPostfix = true;
    return new nodes.Import(this.expect('string').val.val);
  },
  
  /**
   * charset string
   */
  
  get charset() {
    this.expect('charset');
    var str = this.expect('string').val;
    this.allowPostfix = true;
    return new nodes.Charset(str);
  },
  
  /**
   * page selector? block
   */

  get page() {
    var selector;
    this.expect('page');
    if (this.accept(':')) {
      var str = this.expect('ident').val.name;
      selector = new nodes.Literal(':' + str);
    }
    var page = new nodes.Page(selector);
    this.state.push('page');
    page.block = this.block(page);
    this.state.pop();
    return page;
  },

  /**
   * keyframes name ((unit | from | to) block)+
   */
   
  get keyframes() {
    this.expect('keyframes');
    var pos
      , _ = this.css
      , keyframes = new nodes.Keyframes(this.id);

    // css-sty;e
    if (this.css = this.accept('{')) {
      this.skipWhitespace;
    } else {
      this.expect('indent');
    }

    while (pos = this.accept('unit') || this.accept('ident')) {
      // from | to
      if ('ident' == pos.type) {
        this.accept('space');
        switch (pos.val.name) {
          case 'from':
            pos = new nodes.Unit(0, '%');
            break;
          case 'to':
            pos = new nodes.Unit(100, '%');
            break;
          default:
            throw new Error('invalid ident "' + pos.val.name + '" in selector');
        }
      } else {
        pos = pos.val;
      }

      // block
      this.state.push('keyframe');
      var block = this.block(keyframes);
      keyframes.push(pos, block);
      this.state.pop();
      if (this.css) this.skipWhitespace;
    }

    // css-style
    if (this.css) {
      this.skipWhitespace;
      this.expect('}');
      this.css = _;
    } else {
      this.expect('outdent');
    }

    return keyframes;
  },
  
  /**
   * literal
   */
  
  get literal() {
    return this.expect('literal').val;
  },
  
  /**
   * ident space?
   */
  
  get id() {
    var tok = this.expect('ident');
    this.accept('space');
    return tok.val;
  },
  
  /**
   *   ident
   * | assignment
   * | property
   * | selector
   */
  
  get ident() {
    var i = 2
      , la = this.lookahead(i).type;

    while ('space' == la) la = this.lookahead(++i).type;

    switch (la) {
      // Assignment
      case '=':
      case '?=':
      case '-=':
      case '+=':
      case '*=':
      case '/=':
      case '%=':
        return this.assignment
      // Operation
      case '-':
      case '+':
      case '/':
      case '*':
      case '%':
      case '**':
      case 'and':
      case 'or':
      case '&&':
      case '||':
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '!=':
      case '==':
      case '[':
      case '?':
      case 'in':
      case 'is a':
      case 'is defined':
        // Prevent cyclic .ident, return literal
        if (this._ident == this.peek) {
          return this.id;
        } else {
          this._ident = this.peek;
          switch (this.currentState) {
            // unary op or selector in property / for
            case 'for':
            case 'selector':
              return this.property;
            // Part of a selector
            case 'root':
              return this.selector;
            // Do not disrupt the ident when an operand
            default:
              return this.operand
                ? this.id
                : this.expression;
          }
        }
      // Selector or property
      default:
        switch (this.currentState) {
          case 'root':
            return this.selector;
          case 'for':
          case 'page':
          case 'media':
          case 'selector':
          case 'function':
          case 'keyframe':
          case 'conditional':
            return this.property;
          default:
            return this.id;
        }
    }
  },
  
  /**
   * (ident | '{' expression '}')+
   */
  
  get interpolate() {
    var node
      , segs = [];
    while (true) {
      if (this.accept('{')) {
        this.state.push('interpolation');
        segs.push(this.expression);
        this.expect('}');
        this.state.pop();
      } else if (node = this.accept('ident')){
        segs.push(node.val);
      } else {
        break;
      }
    }
    if (!segs.length) this.expect('ident');
    return segs;
  },
  
  /**
   *   property ':'? expression
   * | ident
   */

  get property() {
    if (this.looksLikeSelector) return this.selector;

    // property
    var ident = this.interpolate
      , ret = prop = new nodes.Property(ident);

    // optional ':'
    this.accept('space');
    if (this.accept(':')) this.accept('space');

    this.state.push('property');
    this.inProperty = true;
    prop.expr = this.list;
    if (prop.expr.isEmpty) ret = ident[0];
    this.inProperty = false;
    this.allowPostfix = true;
    this.state.pop();

    // optional ';'
    this.accept(';');

    return ret;
  },
  
  /**
   *   selector ',' selector
   * | selector newline selector
   * | selector block
   */

  get selector() {
    var tok
      , arr
      , val
      , prev
      , parent
      , group = new nodes.Group;

    // Allow comments in selectors
    // for hacks
    this.lexer.allowComments = true;

    do {
      val = prev = null;
      arr = [];

      // Clobber newline after ,
      this.accept('newline');

      // Selector candidates,
      // stitched together to
      // form a selector.
      while (tok = this.selectorToken) {
        // Selector component
        switch (tok.type) {
          case 'unit': val = tok.val.val; break;
          case 'ident': val = tok.val.name; break;
          case 'function': val = tok.val.name + '('; break;
          case 'string': val = tok.val.toString(); break;
          case 'color': val = tok.val.raw; break;
          case 'space': val = ' '; break;
          default: val = tok.val;
        }

        // Whitespace support
        if (!prev || prev.space) {
          arr.push(val);
        } else {
          arr[arr.length-1] += val;
        }
        prev = tok;
      }

      // Push the selector
      group.push(new nodes.Selector(arr.join(' '), parent));
    } while (this.accept(',') || this.accept('newline'));

    this.lexer.allowComments = false;
    this.state.push('selector');
    group.block = this.block(group);
    this.state.pop();


    return group;
  },
  
  /**
   * ident ('=' | '?=') expression
   */
  
  get assignment() {
    var op
      , node
      , name = this.id.name;

    if (op =
         this.accept('=')
      || this.accept('?=')
      || this.accept('+=')
      || this.accept('-=')
      || this.accept('*=')
      || this.accept('/=')
      || this.accept('%=')) {
      this.state.push('assignment');
      var expr = this.list;
      if (expr.isEmpty) this.error('invalid right-hand side operand in assignment, got {peek}')
      node = new nodes.Ident(name, expr);
      this.state.pop();

      switch (op.type) {
        case '?=':
          var defined = new nodes.BinOp('is defined', node)
            , lookup = new nodes.Ident(name);
          node = new nodes.Ternary(defined, lookup, node);
          break;
        case '+=':
        case '-=':
        case '*=':
        case '/=':
        case '%=':
          node.val = new nodes.BinOp(op.type[0], new nodes.Ident(name), expr);
          break;
      }
    }

    return node;
  },
  
  /**
   *   definition
   * | call
   */
  
  get function() {
    var parens = 1
      , i = 2
      , tok;

    // Lookahead and determine if we are dealing
    // with a function call or definition. Here
    // we pair parens to prevent false negatives
    out:
    while (tok = this.lookahead(i++)) {
      switch (tok.type) {
        case 'function': case '(': ++parens; break;
        case ')': if (!--parens) break out;
      }
    }
    
    // Definition or call
    switch (this.currentState) {
      case 'expression':
        return this.functionCall;
      default:
        return this.looksLikeFunctionDefinition(i)
          ? this.functionDefinition
          : this.expression;
    }
  },
  
  /**
   * ident '(' expression ')'
   */
  
  get functionCall() {
    var name = this.expect('function').val.name;
    this.state.push('function arguments');
    var args = this.args;
    this.expect(')');
    this.state.pop();
    return new nodes.Call(name, args);
  },
  
  /**
   * ident '(' params ')' block
   */
  
  get functionDefinition() {
    var name = this.expect('function').val.name;

    // params
    this.state.push('function params');
    var params = this.params;
    this.expect(')');
    this.state.pop();

    // Body
    this.state.push('function');
    var fn = new nodes.Function(name, params);
    fn.block = this.block(fn);
    this.state.pop();
    return new nodes.Ident(name, fn);
  },
  
  /**
   *   ident
   * | ident '...'
   * | ident '=' expression
   * | ident ',' ident
   */
  
  get params() {
    var tok
      , node
      , params = new nodes.Params;
    while (tok = this.accept('ident')) {
      this.accept('space');
      params.push(node = tok.val);
      if (this.accept('...')) {
        node.rest = true;
      } else if (this.accept('=')) {
        node.val = this.expression;
      }
      this.accept(',');
    }
    return params;
  },
  
  /**
   * expression (',' expression)*
   */

  get args() {
    var args = new nodes.Expression;
    do {
      args.push(this.expression);
    } while (this.accept(','));
    return args;
  },
 
  /**
   * expression (',' expression)*
   */

  get list() {
    var node = this.expression;
    while (this.accept(',')) {
      if (node.isList) {
        list.push(this.expression);
      } else {
        var list = new nodes.Expression(true);
        list.push(node);
        list.push(this.expression);
        node = list;
      }
    }
    return node;
  },
  
  /**
   * negation+
   */

  get expression() {
    var node
      , expr = new nodes.Expression;
    this.state.push('expression');
    while (node = this.negation) {
      if (!node) this.error('unexpected token {peek} in expression');
      expr.push(node);
    }
    this.state.pop();
    return expr;
  },
  
  /**
   *   'not' ternary
   * | ternary
   */
  
  get negation() {
    if (this.accept('not')) {
      return new nodes.UnaryOp('!', this.negation);
    }
    return this.ternary;
  },
  
  /**
   * logical ('?' expression ':' expression)?
   */
  
  get ternary() {
    var node = this.logical;
    if (this.accept('?')) {
      var trueExpr = this.expression;
      this.expect(':');
      var falseExpr = this.expression;
      node = new nodes.Ternary(node, trueExpr, falseExpr);
    }
    return node;
  },
  
  /**
   * typecheck (('&&' | '||') typecheck)*
   */
  
  get logical() {
    var op
      , node = this.typecheck;
    while (op = this.accept('&&') || this.accept('||')) {
      node = new nodes.BinOp(op.type, node, this.typecheck);
    }
    return node;
  },
  
  /**
   * equality ('is a' equality)*
   */
  
  get typecheck() {
    var op
      , node = this.equality;
    while (op = this.accept('is a')) {
      this.operand = true;
      if (!node) throw new Error('illegal unary ' + op);
      node = new nodes.BinOp(op.type, node, this.equality);
      this.operand = false;
    }
    return node;
  },
  
  /**
   * in (('==' | '!=') in)*
   */
  
  get equality() {
    var op
      , node = this.in;
    while (op = this.accept('==') || this.accept('!=')) {
      this.operand = true;
      if (!node) throw new Error('illegal unary ' + op);
      node = new nodes.BinOp(op.type, node, this.in);
      this.operand = false;
    }
    return node;
  },

  /**
   * relational ('in' relational)*
   */

  get in() {
    var node = this.relational;
    while (this.accept('in')) {
      this.operand = true;
      if (!node) throw new Error('illegal unary in');
      node = new nodes.BinOp('in', node, this.relational);
      this.operand = false;
    }
    return node;
  },
  
  /**
   * range (('>=' | '<=' | '>' | '<') range)*
   */
  
  get relational() {
    var op
      , node = this.range;
    while (op = 
         this.accept('>=')
      || this.accept('<=')
      || this.accept('<')
      || this.accept('>')
      ) {
      this.operand = true;
      if (!node) throw new Error('illegal unary ' + op);
      node = new nodes.BinOp(op.type, node, this.range);
      this.operand = false;
    }
    return node;
  },
  
  /**
   * additive (('..' | '...') additive)*
   */
  
  get range() {
    var op
      , node = this.additive;
    if (op = this.accept('...') || this.accept('..')) {
      this.operand = true;
      if (!node) throw new Error('illegal unary ' + op);
      node = new nodes.BinOp(op.val, node, this.additive);
      this.operand = false;
    }
    return node;
  },
  
  /**
   * multiplicative (('+' | '-') multiplicative)*
   */
  
  get additive() {
    var op
      , node = this.multiplicative;
    while (op = this.accept('+') || this.accept('-')) {
      this.operand = true;
      node = new nodes.BinOp(op.type, node, this.multiplicative);
      this.operand = false;
    }
    return node;
  },
  
  /**
   * defined (('**' | '*' | '/' | '%') defined)*
   */
  
  get multiplicative() {
    var op
      , node = this.defined;
    while (op =
         this.accept('**')
      || this.accept('*')
      || this.accept('/')
      || this.accept('%')) {
      this.operand = true;
      if ('/' == op && this.inProperty && !this.parens) {
        var expr = new nodes.Expression;
        expr.push(node);
        expr.push(new nodes.Literal('/'));
        return expr;
      } else {
        if (!node) throw new Error('illegal unary ' + op);
        node = new nodes.BinOp(op.type, node, this.defined);
        this.operand = false;
      }
    }
    return node;
  },
  
  /**
   *    unary 'is defined'
   *  | unary
   */
  
  get defined() {
    var node = this.unary;
    if (this.accept('is defined')) {
      if (!node) throw new Error('illegal use of "is defined"');
      node = new nodes.BinOp('is defined', node);
    }
    return node;
  },
  
  /**
   *   ('!' | '~' | '+' | '-') unary
   * | subscript
   */
  
  get unary() {
    var op
      , node;
    if (op =
         this.accept('!')
      || this.accept('~')
      || this.accept('+')
      || this.accept('-')) {
      this.operand = true;
      node = new nodes.UnaryOp(op.type, this.unary);
      this.operand = false;
      return node;
    }
    return this.subscript;
  },
  
  /**
   *   primary ('[' expression ']')+
   * | primary
   */
  
  get subscript() {
    var node = this.primary;
    while (this.accept('[')) {
      node = new nodes.BinOp('[]', node, this.expression);
      this.expect(']');
    }
    return node;
  },
  
  /**
   *   unit
   * | null
   * | color
   * | string
   * | ident
   * | boolean
   * | literal
   * | '(' expression ')'
   */

  get primary() {
    var op
      , node;

    // Parenthesis
    if (this.accept('(')) {
      this.parens = true;
      var expr = this.expression;
      this.expect(')');
      this.parens = false;
      return expr;
    }

    // Primitive
    switch (this.peek.type) {
      case 'null':
      case 'unit':
      case 'color':
      case 'string':
      case 'literal':
      case 'boolean':
        return this.next.val;
      case 'ident':
        return this.ident;
      case 'function':
        return this.functionCall;
    }
  }
};
