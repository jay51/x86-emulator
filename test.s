.LC0:
        .string "hello world"

do_nothing:
        pushq   %rbp
        movq    %rsp, %rbp
        movq    $42, %rdi
        call    puts
        popq    %rbp
        ret

main:
        pushq   %rbp
        movq    %rsp, %rbp
        subq    $16, %rsp
        movq    $.LC0, -8(%rbp)
        movq    -8(%rbp), %rax
        movq    %rax, %rdi
        call    puts
        call    do_nothing
        movq    $0, %rax
        leave
        ret
