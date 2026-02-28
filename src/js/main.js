import '../scss/style.scss'
import 'bootstrap/dist/css/bootstrap.min.css'
import '../scss/layout.scss'
import javascriptLogo from '../javascript.svg'
import viteLogo from '../../public/vite.svg'
import { setupCounter } from '../counter.js'
import * as yup from 'yup';

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

// setup onchange handler on rss input / change @todo - paste input
let rssinput=document.querySelector('#inputRSSchannel');
let button =document.querySelector('#rssFormButton');

function validate(callback){
  // --------------------------
let schema = yup.object().shape({
  rss: yup.string().required().url(),
  createdOn: yup.date().default(function () {
    return new Date();
  }),
});
schema.validate({ rss: rssinput.value }).catch(function (err) {
    // Не должно быть пустым, Ссылка должна быть валидным URL
    if(err.name=='ValidationError'){
      if(err.errors.includes("rss must be a valid URL")){
        rssinput.setCustomValidity("Ссылка должна быть валидным URL")
      } else if(err.errors.includes("rss is a required field")){
        rssinput.setCustomValidity("Не должно быть пустым")
      } else {
        rssinput.setCustomValidity(err.errors[0])
      }
      rssinput.classList.add('is-invalid')
      rssinput.classList.remove('is-valid')
      
    }//console.log( err.name, // => 'ValidationError'
 // err.errors); // => [{ key: 'field_too_short', values: { min: 18 } }]
}).then(function (valid) {
  if(valid){
      rssinput.setCustomValidity('');
      rssinput.classList.remove('is-invalid')
      rssinput.classList.add('is-valid')
      callback (valid)
  } else {
    rssinput.reportValidity();
  };
})
}
rssinput.addEventListener('change', () =>  validate((obj)=>{
  console.log('input',obj)
 }))
 rssinput.addEventListener('paste', () =>  validate((obj)=>{
  console.log('paste',obj)
 }))
 rssinput.addEventListener('input', () =>  
  rssinput.setCustomValidity('')
 )

 button.addEventListener('click', () => validate((obj)=>{
  console.log('button',obj)
 }))
 

