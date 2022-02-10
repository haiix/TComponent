# TComponent
A tiny base component written in ES6.

## Installation

```
npm install @haiix/tcomponent
```

## Usage

```javascript
import TComponent from '@haiix/tcomponent'

// Extend the TComponent class to implement the template method.
class App extends TComponent {
  template () {
    return `
      <section>
        <!-- The "id" attributes are registered as a property of the instance and are removed from the entity of the elements. -->
        <h1 id="myOutput">Hello, </h1>

        <!-- Attributes beginning with "on" are recognized as event functions, and "this" is bound to the instance. -->
        <button onclick="this.handleMyButton(event)">Click here</button>
      </section>
    `
  }

  handleMyButton (event) {
    this.myOutput.textContent += 'World!'
  }
}

const app = new App()
document.body.appendChild(app.element) // The root element of the template is registered as the "element" property of the instance.
```

## Examples

https://haiix.github.io/TComponent/examples/

## Tests

https://haiix.github.io/TComponent/tests/

## License

MIT

