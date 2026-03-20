function Demo() {
  let a = 1
  let unusedVar = 5

  console.log("debug") // no-console: warn

  if (a == "1") { // eqeqeq: warn
    debugger // no-debugger: error
  }

  b = 10 // no-undef: error

  return <div>Hello</div>
}

export default Demo