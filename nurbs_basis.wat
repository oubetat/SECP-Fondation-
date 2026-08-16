(module
  (import "env" "memory" (memory 16 256))
  (func $native_nurbs_basis (export "native_nurbs_basis") (param $i i32) (param $p i32) (param $u f64) (param $knots i32) (param $knots_len i32) (result f64)
    (local $left f64)
    (local $right f64)
    (local $denom1 f64)
    (local $denom2 f64)
    (local $k_i f64)
    (local $k_ip1 f64)
    (local $k_ip_p f64)
    (local $k_ip1_p1 f64)
    (local $k_last f64)

    (if (i32.eq (local.get $p) (i32.const 0))
      (then
        (local.set $k_i (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (local.get $i) (i32.const 3)))))
        (local.set $k_ip1 (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 3)))))
        
        (if (i32.and (f64.ge (local.get $u) (local.get $k_i)) (f64.lt (local.get $u) (local.get $k_ip1)))
          (then (return (f64.const 1.0)))
        )
        
        (local.set $k_last (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (i32.sub (local.get $knots_len) (i32.const 1)) (i32.const 3)))))
        (if (i32.and (f64.eq (local.get $u) (local.get $k_last)) (f64.eq (local.get $u) (local.get $k_ip1)))
          (then (return (f64.const 1.0)))
        )
        (return (f64.const 0.0))
      )
    )

    (local.set $left (f64.const 0.0))
    (local.set $k_i (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (local.get $i) (i32.const 3)))))
    (local.set $k_ip_p (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (i32.add (local.get $i) (local.get $p)) (i32.const 3)))))
    (local.set $denom1 (f64.sub (local.get $k_ip_p) (local.get $k_i)))
    
    (if (f64.gt (local.get $denom1) (f64.const 1e-12))
      (then
        (local.set $left 
          (f64.mul 
            (f64.div (f64.sub (local.get $u) (local.get $k_i)) (local.get $denom1))
            (call $native_nurbs_basis (local.get $i) (i32.sub (local.get $p) (i32.const 1)) (local.get $u) (local.get $knots) (local.get $knots_len))
          )
        )
      )
    )

    (local.set $right (f64.const 0.0))
    (local.set $k_ip1 (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (i32.add (local.get $i) (i32.const 1)) (i32.const 3)))))
    (local.set $k_ip1_p1 (f64.load offset=0 align=8 (i32.add (local.get $knots) (i32.shl (i32.add (i32.add (local.get $i) (local.get $p)) (i32.const 1)) (i32.const 3)))))
    (local.set $denom2 (f64.sub (local.get $k_ip1_p1) (local.get $k_ip1)))

    (if (f64.gt (local.get $denom2) (f64.const 1e-12))
      (then
        (local.set $right 
          (f64.mul 
            (f64.div (f64.sub (local.get $k_ip1_p1) (local.get $u)) (local.get $denom2))
            (call $native_nurbs_basis (i32.add (local.get $i) (i32.const 1)) (i32.sub (local.get $p) (i32.const 1)) (local.get $u) (local.get $knots) (local.get $knots_len))
          )
        )
      )
    )

    (f64.add (local.get $left) (local.get $right))
  )
)
