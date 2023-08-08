'use strict';

const javascript = (expr) => `
const expr = (
    ${expr}
);
console.log(expr)
`,
  python = (expr) => `
expr = ${expr}
print(f"{expr}")
`,
  rust = (expr) => `
fn main() {
    println!("{}", {
        ${expr}
    });
}
`,
  haskell = (expr) => `
main = putStrLn $ show expr
    where expr = ${expr}
`,
  clojure = (expr) => `
(println 
    ${expr}
    )
`,
  coffeescript = (expr) => `
expr = ${expr}
console.log expr
`,
  cpp = (expr) => `
#include <iostream>
using namespace std;
int main() {
    auto expr = ${expr}
        ;
    cout << expr;
    return 0;
}
`,
  crystal = (expr) => `
expr = ${expr}
puts expr
`,
  csharp = (expr) => `
using System;
class MainClass {
    static void Main() {
        var expr = ${expr}
            ;
        
        Console.WriteLine(expr);
    }
}`,
  d = (expr) => `
import std.stdio;
void main()
{
    auto expr = ${expr}
        ;
    
    writeln(expr);
}
`,
  elixir = (expr) => `
expr = ${expr}
IO.puts expr
`,
  go = (expr) => `
package main
import (
    "fmt"
)
func main() {
    expr :=
        ${expr}
        
    fmt.Println(expr)
}
`,
  kotlin = (expr) => `
fun main(args : Array<String>){
    var expr = 
        ${expr}
        
    println(expr)
}
`,
  lua = (expr) => `
expr = ${expr}
print(expr);
`,
  ruby = (expr) => `
expr = 
    ${expr}
puts expr
`,
  scala = (expr) => `
object Main extends App {
    var expr = 
        ${expr}
        
    println(expr)
}`,
  swift = (expr) => `
let expr =
    ${expr}
    ;
print(expr)
`,
  typescript = javascript;

module.exports = {
  javascript,
  python,
  rust,
  haskell,
  clojure,
  coffeescript,
  cpp,
  crystal,
  csharp,
  d,
  elixir,
  go,
  kotlin,
  lua,
  ruby,
  scala,
  swift,
  typescript,
};