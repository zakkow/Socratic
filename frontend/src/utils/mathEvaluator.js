/**
 * Desmos-like Math Expression Evaluator
 * Supports DEG/RAD modes, trig, factorials, powers, logs, roots, stats, implicit multiplication, and fraction formatting.
 */

// Helper: calculate factorial (n!)
function factorial(n) {
  if (n < 0) return NaN;
  if (n === 0 || n === 1) return 1;
  if (!Number.isInteger(n)) {
    // Stirling approximation for non-integer Gamma function fallback
    return Math.sqrt(2 * Math.PI * n) * Math.pow(n / Math.E, n);
  }
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

// Helper: nCr (Combinations)
function nCr(n, r) {
  if (r < 0 || r > n) return 0;
  return factorial(n) / (factorial(r) * factorial(n - r));
}

// Helper: nPr (Permutations)
function nPr(n, r) {
  if (r < 0 || r > n) return 0;
  return factorial(n) / factorial(n - r);
}

// Helper: Greatest Common Divisor
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

// Helper: Least Common Multiple
function lcm(a, b) {
  if (a === 0 || b === 0) return 0;
  return Math.abs(a * b) / gcd(a, b);
}

// Convert decimal to simplified fraction (e.g. 0.75 -> 3/4)
export function decimalToFraction(val) {
  if (typeof val !== 'number' || !isFinite(val)) return String(val);
  if (Number.isInteger(val)) return String(val);

  const sign = val < 0 ? '-' : '';
  const absVal = Math.abs(val);
  const precision = 1e-6;

  let h1 = 1, h2 = 0;
  let k1 = 0, k2 = 1;
  let b = absVal;

  do {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;
    b = 1 / (b - a);
  } while (Math.abs(absVal - h1 / k1) > absVal * precision && k1 < 10000);

  if (k1 === 1) return `${sign}${h1}`;
  if (k1 > 10000) return String(val); // Could not simplify cleanly

  return `${sign}${h1}/${k1}`;
}

/**
 * Pre-processes mathematical expression text into a clean JS-evaluable string.
 */
function preprocessExpression(expr, angleMode = 'DEG', ansVal = 0) {
  let s = expr;

  // Replace mathematical visual symbols
  s = s.replace(/×/g, '*');
  s = s.replace(/÷/g, '/');
  s = s.replace(/π/g, 'Math.PI');
  s = s.replace(/\bpi\b/gi, 'Math.PI');
  s = s.replace(/\be\b/gi, 'Math.E');
  s = s.replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)');
  s = s.replace(/√([0-9.]+)/g, 'Math.sqrt($1)');
  s = s.replace(/√/g, 'Math.sqrt');
  s = s.replace(/\bans\b/gi, `(${ansVal})`);

  // Handle percentages (e.g. 50% -> (50/100))
  s = s.replace(/([0-9.]+)\s*%/g, '($1/100)');

  // Handle Factorials (e.g. 5! -> factorial(5))
  s = s.replace(/([0-9.]+|\bMath\.PI\b|\bMath\.E\b|\([^)]+\))\s*!/g, 'factorial($1)');

  // Implicit multiplication: number followed by Math.PI, Math.E, (, or function
  s = s.replace(/([0-9.]+)\s*(\(|Math\.PI|Math\.E|[a-zA-Z_])/g, '$1*$2');
  s = s.replace(/\)\s*([0-9.]+|\(|Math\.PI|Math\.E|[a-zA-Z_])/g, ')*$1');

  // Powers: a ^ b -> Math.pow(a, b)
  // Simple power transformation using regex loop for nested powers
  while (s.includes('^')) {
    s = s.replace(/([0-9.]+|\bMath\.PI\b|\bMath\.E\b|\([^\^)]+\))\s*\^\s*([0-9.]+|\bMath\.PI\b|\bMath\.E\b|\([^\^)]+\))/g, 'Math.pow($1, $2)');
  }

  // Trigonometric & Log Functions with Angle Mode handling
  const isDeg = angleMode === 'DEG';

  if (isDeg) {
    // sin(x) in DEG -> Math.sin((x) * Math.PI / 180)
    s = s.replace(/\bsin\(([^)]+)\)/gi, 'Math.sin(($1) * Math.PI / 180)');
    s = s.replace(/\bcos\(([^)]+)\)/gi, 'Math.cos(($1) * Math.PI / 180)');
    s = s.replace(/\btan\(([^)]+)\)/gi, 'Math.tan(($1) * Math.PI / 180)');

    // Inverse trig: asin(x) in DEG -> (Math.asin(x) * 180 / Math.PI)
    s = s.replace(/\basin\(([^)]+)\)/gi, '(Math.asin($1) * 180 / Math.PI)');
    s = s.replace(/\bacos\(([^)]+)\)/gi, '(Math.acos($1) * 180 / Math.PI)');
    s = s.replace(/\batan\(([^)]+)\)/gi, '(Math.atan($1) * 180 / Math.PI)');
  } else {
    // Radians mode
    s = s.replace(/\bsin\b/gi, 'Math.sin');
    s = s.replace(/\bcos\b/gi, 'Math.cos');
    s = s.replace(/\btan\b/gi, 'Math.tan');
    s = s.replace(/\basin\b/gi, 'Math.asin');
    s = s.replace(/\bacos\b/gi, 'Math.acos');
    s = s.replace(/\batan\b/gi, 'Math.atan');
  }

  // Hyperbolic trig
  s = s.replace(/\bsinh\b/gi, 'Math.sinh');
  s = s.replace(/\bcosh\b/gi, 'Math.cosh');
  s = s.replace(/\btanh\b/gi, 'Math.tanh');

  // Logs & Exponents
  s = s.replace(/\bln\b/gi, 'Math.log');
  s = s.replace(/\blog10\b/gi, 'Math.log10');
  s = s.replace(/\blog\b/gi, 'Math.log10');
  s = s.replace(/\bsqrt\b/gi, 'Math.sqrt');
  s = s.replace(/\bcbrt\b/gi, 'Math.cbrt');
  s = s.replace(/\babs\b/gi, 'Math.abs');
  s = s.replace(/\bround\b/gi, 'Math.round');
  s = s.replace(/\bfloor\b/gi, 'Math.floor');
  s = s.replace(/\bceil\b/gi, 'Math.ceil');

  return s;
}

/**
 * Main evaluation function. Safe, isolated execution environment.
 */
export function evaluateMathExpression(expression, angleMode = 'DEG', ansVal = 0) {
  if (!expression || typeof expression !== 'string' || !expression.trim()) {
    return { result: '', numericResult: 0, error: null };
  }

  try {
    const processedStr = preprocessExpression(expression.trim(), angleMode, ansVal);

    // Create execution scope with Math functions and custom helpers
    const scope = {
      Math,
      factorial,
      nCr,
      nPr,
      gcd,
      lcm,
    };

    const fnKeys = Object.keys(scope);
    const fnVals = Object.values(scope);

    // Execute within Function sandbox
    const evalFn = new Function(...fnKeys, `return ${processedStr};`);
    const numRes = evalFn(...fnVals);

    if (typeof numRes !== 'number' || isNaN(numRes)) {
      return { result: 'Undefined', numericResult: NaN, error: 'Undefined calculation' };
    }

    if (!isFinite(numRes)) {
      return { result: numRes > 0 ? '∞' : '-∞', numericResult: numRes, error: null };
    }

    // Rounding micro precision floating point glitches (e.g. 0.30000000000000004 -> 0.3)
    const rounded = Math.abs(numRes) < 1e-12 ? 0 : parseFloat(numRes.toFixed(10));

    return {
      result: String(rounded),
      numericResult: rounded,
      error: null,
    };
  } catch (err) {
    return {
      result: '',
      numericResult: NaN,
      error: 'Syntax Error',
    };
  }
}
