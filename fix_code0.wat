(module
  (import "env" "memory" (memory 16 256))
  (func (export "vector_dot_f64") (param $n i32) (param $xPtr i32) (param $yPtr i32) (result f64)
    (local $sum f64)
    (local $i i32)
    (local.set $sum (f64.const 0.0))
    (local.set $i (i32.const 0))
    (loop $L
      (if (i32.lt_s (local.get $i) (local.get $n))
        (then
          (local.set $sum
            (f64.add
              (local.get $sum)
              (f64.mul
                (f64.load offset=0 align=8 (i32.add (local.get $xPtr) (i32.shl (local.get $i) (i32.const 3))))
                (f64.load offset=0 align=8 (i32.add (local.get $yPtr) (i32.shl (local.get $i) (i32.const 3))))
              )
            )
          )
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $L)
        )
      )
    )
    (local.get $sum)
  )
)
