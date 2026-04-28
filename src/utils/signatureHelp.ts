import { StateField, StateEffect, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, type Tooltip } from '@codemirror/view';

/* ── Signature database (JS/TS built-ins) ─────────────────────── */
interface SignatureInfo {
  params: string[];
  doc?: string;
}

const SIGNATURES: Record<string, SignatureInfo> = {
  'console.log': { params: ['msg: any'], doc: 'Outputs a message to the console' },
  'console.error': { params: ['msg: any'], doc: 'Outputs an error message to the console' },
  'console.warn': { params: ['msg: any'], doc: 'Outputs a warning message to the console' },
  'console.info': { params: ['msg: any'], doc: 'Outputs an informational message to the console' },
  'Array.from': { params: ['iterable: Iterable<T>'], doc: 'Creates an array from an iterable' },
  'Array.isArray': { params: ['obj: any'], doc: 'Returns true if obj is an array' },
  'Object.keys': { params: ['obj: object'], doc: 'Returns the names of the enumerable string properties' },
  'Object.values': { params: ['obj: object'], doc: 'Returns an array of values of the enumerable properties' },
  'Object.entries': { params: ['obj: object'], doc: 'Returns an array of key-value pairs' },
  'JSON.parse': { params: ['text: string'], doc: 'Parses a JSON string into a JavaScript value' },
  'JSON.stringify': { params: ['value: any', 'replacer?: (key: string, value: any) => any', 'space?: string | number'], doc: 'Converts a JavaScript value to a JSON string' },
  'Math.max': { params: ['...values: number[]'], doc: 'Returns the largest of zero or more numbers' },
  'Math.min': { params: ['...values: number[]'], doc: 'Returns the smallest of zero or more numbers' },
  'Math.abs': { params: ['x: number'], doc: 'Returns the absolute value of a number' },
  'Math.floor': { params: ['x: number'], doc: 'Returns the greatest integer less than or equal to x' },
  'Math.ceil': { params: ['x: number'], doc: 'Returns the smallest integer greater than or equal to x' },
  'Math.round': { params: ['x: number'], doc: 'Returns the value of a number rounded to the nearest integer' },
  'Math.random': { params: [], doc: 'Returns a pseudo-random number between 0 and 1' },
  'setTimeout': { params: ['callback: () => void', 'delay?: number'], doc: 'Executes a function after a specified delay (ms)' },
  'clearTimeout': { params: ['id: number'], doc: 'Cancels a timeout previously established by setTimeout' },
  'setInterval': { params: ['callback: () => void', 'delay?: number'], doc: 'Repeatedly calls a function with a fixed time delay' },
  'clearInterval': { params: ['id: number'], doc: 'Cancels a timed repeating action previously established by setInterval' },
  'parseInt': { params: ['string: string', 'radix?: number'], doc: 'Parses a string argument and returns an integer' },
  'parseFloat': { params: ['string: string'], doc: 'Parses a string argument and returns a floating point number' },
  'isNaN': { params: ['value: any'], doc: 'Returns true if the given value is NaN' },
  'isFinite': { params: ['value: any'], doc: 'Returns true if the given value is a finite number' },
  'encodeURI': { params: ['uri: string'], doc: 'Encodes a URI by replacing each instance of certain characters' },
  'decodeURI': { params: ['encodedURI: string'], doc: 'Decodes a URI previously created by encodeURI' },
  'encodeURIComponent': { params: ['uriComponent: string'], doc: 'Encodes a URI component' },
  'decodeURIComponent': { params: ['encodedURIComponent: string'], doc: 'Decodes a URI component' },
  'document.getElementById': { params: ['id: string'], doc: 'Returns a reference to the element by its ID' },
  'document.querySelector': { params: ['selectors: string'], doc: 'Returns the first Element within the document that matches the specified selector' },
  'document.querySelectorAll': { params: ['selectors: string'], doc: 'Returns a static NodeList representing a list of elements matching the selectors' },
  'document.createElement': { params: ['tagName: string'], doc: 'Creates the HTML element specified by tagName' },
  'window.addEventListener': { params: ['type: string', 'listener: EventListener'], doc: 'Sets up a function to be called when the specified event is delivered' },
  'addEventListener': { params: ['type: string', 'listener: EventListener'], doc: 'Sets up a function to be called when the specified event is delivered' },
  'push': { params: ['...items: T[]'], doc: 'Adds one or more elements to the end of an array' },
  'map': { params: ['callbackfn: (value: T, index: number, array: T[]) => U'], doc: 'Creates a new array populated with the results of calling a provided function' },
  'filter': { params: ['predicate: (value: T, index: number, array: T[]) => boolean'], doc: 'Creates a shallow copy of a portion of a given array' },
  'reduce': { params: ['callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T', 'initialValue?: T'], doc: 'Executes a user-supplied reducer callback function on each element' },
  'forEach': { params: ['callbackfn: (value: T, index: number, array: T[]) => void'], doc: 'Executes a provided function once for each array element' },
  'find': { params: ['predicate: (value: T, index: number, obj: T[]) => boolean'], doc: 'Returns the first element that satisfies the provided testing function' },
  'findIndex': { params: ['predicate: (value: T, index: number, obj: T[]) => boolean'], doc: 'Returns the index of the first element that satisfies the provided testing function' },
  'includes': { params: ['searchElement: T', 'fromIndex?: number'], doc: 'Determines whether an array includes a certain value among its entries' },
  'indexOf': { params: ['searchElement: T', 'fromIndex?: number'], doc: 'Returns the first index at which a given element can be found' },
  'join': { params: ['separator?: string'], doc: 'Creates and returns a new string by concatenating all of the elements in an array' },
  'split': { params: ['separator?: string | RegExp', 'limit?: number'], doc: 'Divides a String into an ordered list of substrings' },
  'slice': { params: ['start?: number', 'end?: number'], doc: 'Extracts a section of a string/array and returns it as a new string/array' },
  'splice': { params: ['start: number', 'deleteCount?: number', '...items: T[]'], doc: 'Changes the contents of an array by removing or replacing existing elements' },
  'substring': { params: ['indexStart: number', 'indexEnd?: number'], doc: 'Returns the part of the string between the start and end indexes' },
  'replace': { params: ['pattern: string | RegExp', 'replacement: string'], doc: 'Returns a new string with one, some, or all matches of a pattern replaced' },
  'match': { params: ['regexp: RegExp'], doc: 'Retrieves the result of matching a string against a regular expression' },
  'test': { params: ['string: string'], doc: 'Executes a search for a match between a regular expression and a specified string' },
  'toString': { params: [], doc: 'Returns a string representing the object' },
  'toFixed': { params: ['digits?: number'], doc: 'Formats a number using fixed-point notation' },
  'toUpperCase': { params: [], doc: 'Returns the calling string value converted to uppercase' },
  'toLowerCase': { params: [], doc: 'Returns the calling string value converted to lowercase' },
  'trim': { params: [], doc: 'Removes whitespace from both ends of a string' },
  'startsWith': { params: ['searchString: string', 'position?: number'], doc: 'Determines whether a string begins with the characters of a specified string' },
  'endsWith': { params: ['searchString: string', 'endPosition?: number'], doc: 'Determines whether a string ends with the characters of a specified string' },
  'includes_str': { params: ['searchString: string', 'position?: number'], doc: 'Determines whether one string may be found within another string' },
  'charAt': { params: ['index: number'], doc: 'Returns a new string consisting of the single UTF-16 code unit at the given index' },
  'charCodeAt': { params: ['index: number'], doc: 'Returns an integer between 0 and 65535 representing the UTF-16 code unit at the given index' },
  'at': { params: ['index: number'], doc: 'Takes an integer value and returns the item at that index' },
  'concat': { params: ['...strings: string[]'], doc: 'Concatenates the string arguments to the calling string and returns a new string' },
  'padStart': { params: ['targetLength: number', 'padString?: string'], doc: 'Pads the current string with another string until the given length' },
  'padEnd': { params: ['targetLength: number', 'padString?: string'], doc: 'Pads the current string with a given string so that the resulting string reaches a given length' },
  'repeat': { params: ['count: number'], doc: 'Constructs and returns a new string which contains the specified number of copies' },
  'localeCompare': { params: ['compareString: string'], doc: 'Returns a number indicating whether a reference string comes before or after or is the same as the given string' },
};

const setSigEffect = StateEffect.define<SigState>();

interface SigState {
  active: boolean;
  tooltip: Tooltip | null;
}

const sigStateField = StateField.define<SigState>({
  create(): SigState {
    return { active: false, tooltip: null };
  },
  update(state, tr) {
    for (const e of tr.effects) {
      if (e.is(setSigEffect)) return e.value;
    }
    // Hide on any doc change that isn't just typing inside the call
    if (tr.docChanged && state.active) {
      const newText = tr.newDoc.toString();
      // Keep showing if we're still inside parentheses of the same call
      // Simple heuristic: if there are unclosed parens before cursor
      const pos = tr.newSelection.main.head;
      let depth = 0;
      for (let i = pos - 1; i >= 0; i--) {
        const ch = newText[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
          if (depth === 0) break;
          depth--;
        }
        else if (ch === '}' || ch === ']' || ch === '"' || ch === "'" || ch === '`') {
          // Heuristic: hide if we encounter other brackets/strings
          // This is imperfect but good enough for a lightweight implementation
        }
      }
      // Simple heuristic: keep showing if doc length increased by 1 (typing)
      const oldLen = tr.startState.doc.length;
      const newLen = tr.newDoc.length;
      if (newLen - oldLen === 1) {
        return state;
      }
      return { active: false, tooltip: null };
    }
    return state;
  },
  provide: (f) => showTooltip.from(f, (val) => val.tooltip),
});

function findFunctionName(doc: string, pos: number): string | null {
  // Walk backwards to find the identifier before the '(' at position pos
  let i = pos - 1;
  // Skip whitespace before '('
  while (i >= 0 && /\s/.test(doc[i])) i--;
  if (i < 0 || doc[i] !== '(') return null;

  i--;
  while (i >= 0 && /\s/.test(doc[i])) i--;

  // Collect identifier characters
  let name = '';
  while (i >= 0 && /[a-zA-Z0-9_$.]/.test(doc[i])) {
    name = doc[i] + name;
    i--;
  }

  return name || null;
}

function buildSignatureTooltip(name: string, sig: SignatureInfo): Tooltip {
  const paramsHtml = sig.params
    .map((p, i) => `<span class="sig-param" data-index="${i}">${p}</span>`)
    .join(', ');
  const docHtml = sig.doc ? `<div class="sig-doc">${sig.doc}</div>` : '';

  return {
    pos: 0, // will be set dynamically
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-signature-tooltip';
      dom.innerHTML = `<div class="sig-name">${name}</div><div class="sig-signature">(${paramsHtml})</div>${docHtml}`;
      return { dom };
    },
  };
}

/**
 * Lightweight signature help extension.
 * Shows a tooltip when the user types '(' after a known function name.
 */
export function signatureHelp(): Extension {
  return [
    sigStateField,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;

      const tr = update.transactions[update.transactions.length - 1];
      if (!tr) return;

      const pos = tr.newSelection.main.head;
      const doc = tr.newDoc.toString();

      // Check if we just typed '('
      if (doc[pos - 1] !== '(') return;

      const name = findFunctionName(doc, pos);
      if (!name) return;

      const sig = SIGNATURES[name];
      if (!sig) return;

      const tooltip = buildSignatureTooltip(name, sig);
      tooltip.pos = pos;

      update.view.dispatch({
        effects: setSigEffect.of({ active: true, tooltip }),
      });
    }),
  ];
}
