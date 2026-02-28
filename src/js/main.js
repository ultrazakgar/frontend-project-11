import '../scss/style.scss'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../scss/layout.scss'
import javascriptLogo from '../javascript.svg'
import viteLogo from '../../public/vite.svg'
import { setupCounter } from '../counter.js'

document.querySelector('#app-footer').innerHTML = `
  Created by me
`
// rss grid here
document.querySelector('#app-container').innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript" target="_blank">
      <img src="${javascriptLogo}" class="logo vanilla" alt="JavaScript logo" />
    </a>
    <h1>Hello Vite!</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite logo to learn more
    </p>
  </div>
`
// form here

setupCounter(document.querySelector('#counter'))
