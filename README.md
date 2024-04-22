# TComponent
A tiny component system written in TypeScript.

## Installation

```
npm install @haiix/tcomponent
```

## Usage

```javascript
import TComponent from '@haiix/tcomponent'

class App extends TComponent {
  static template = `
    <section>
      <!-- The "id" attribute is removed from the element after instantiation. -->
      <h1 id="myOutput">Hello, </h1>

      <!-- Attributes beginning with "on" are recognized as event functions, and "this" is bound to the instance. -->
      <button onclick="this.handleMyButton(event)">Click here</button>
    </section>
  `;

  // Bind the id to the instance.
  myOutput = this.id('myOutput');

  handleMyButton(event) {
    this.myOutput.textContent += 'World!';
  }

  // Errors thrown in the events are handled by "onerror" method.
  onerror(error) {
    console.error(error);
  }
}

const app = new App();
document.body.appendChild(app.element);
```

## Examples

https://haiix.github.io/TComponent/examples/

## License

MIT

