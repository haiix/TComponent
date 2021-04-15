# TComponent
A tiny base component written in ES6.

## Installation

```
npm install @haiix/tcomponent
```

## Usage

```javascript
import TComponent from '@haiix/tcomponent'

class App extends TComponent {
  template () {
    return `
      <section>
        <h1 id="output">Hello, </h1>
        <button onclick="this.handleButton(event)">Click here</button>
      </section>
    `
  }

  handleButton (event) {
    this.output.textContent += 'World!'
  }
}

const app = new App()
document.body.appendChild(app.element)
```

## Examples

https://haiix.github.io/TComponent/examples/
