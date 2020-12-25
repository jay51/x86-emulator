# The simplest x86 userspace emulator in nodejs!
### Features
  - AT&T Assembly Syntax
  - Labels 
  - Directives
  - Subroutines
  - No comparison instructions yet
  - No jump instructions yet
  - No loops yet

### Try it out
```c
// main.c
#include<stdio.h>
int do_nothing() {
    return 42;
}
int main() {
    char *string = "hello world";
    puts(string);
    do_nothing();
    return 0;
}
// compile with flags 
gcc -S -fno-asynchronous-unwind-tables -fno-exceptions main.c
// convert 32b instructions and registers to 64 e.g.
movl	$0, %eax
To
movq	$0, %rax
```

##### Run
```sh
$ node main.js  main.S
```



