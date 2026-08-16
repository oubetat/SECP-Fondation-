(module
  (import "env" "memory" (memory 16 256))
  (func (export "native_cfd_flux") 
    (param $rho_L f64) (param $u_L f64) (param $v_L f64) (param $w_L f64) (param $p_L f64)
    (param $rho_R f64) (param $u_R f64) (param $v_R f64) (param $w_R f64) (param $p_R f64)
    (param $nx f64) (param $ny f64) (param $nz f64) (param $area f64)
    (param $out_fluxes i32)

    (local $rho f64)
    (local $u f64)
    (local $v f64)
    (local $w f64)
    (local $p f64)
    (local $vn f64)
    (local $energy f64)

    (local.set $rho (f64.mul (f64.const 0.5) (f64.add (local.get $rho_L) (local.get $rho_R))))
    (local.set $u (f64.mul (f64.const 0.5) (f64.add (local.get $u_L) (local.get $u_R))))
    (local.set $v (f64.mul (f64.const 0.5) (f64.add (local.get $v_L) (local.get $v_R))))
    (local.set $w (f64.mul (f64.const 0.5) (f64.add (local.get $w_L) (local.get $w_R))))
    (local.set $p (f64.mul (f64.const 0.5) (f64.add (local.get $p_L) (local.get $p_R))))

    ;; vn = u * nx + v * ny + w * nz
    (local.set $vn 
      (f64.add
        (f64.add
          (f64.mul (local.get $u) (local.get $nx))
          (f64.mul (local.get $v) (local.get $ny))
        )
        (f64.mul (local.get $w) (local.get $nz))
      )
    )

    ;; out_fluxes[0] = rho * vn * area;
    (f64.store offset=0 align=8 (local.get $out_fluxes)
      (f64.mul (f64.mul (local.get $rho) (local.get $vn)) (local.get $area))
    )

    ;; out_fluxes[1] = (rho * u * vn + p * nx) * area;
    (f64.store offset=8 align=8 (local.get $out_fluxes)
      (f64.mul 
        (f64.add 
          (f64.mul (f64.mul (local.get $rho) (local.get $u)) (local.get $vn))
          (f64.mul (local.get $p) (local.get $nx))
        ) 
        (local.get $area)
      )
    )

    ;; out_fluxes[2] = (rho * v * vn + p * ny) * area;
    (f64.store offset=16 align=8 (local.get $out_fluxes)
      (f64.mul 
        (f64.add 
          (f64.mul (f64.mul (local.get $rho) (local.get $v)) (local.get $vn))
          (f64.mul (local.get $p) (local.get $ny))
        ) 
        (local.get $area)
      )
    )

    ;; out_fluxes[3] = (rho * w * vn + p * nz) * area;
    (f64.store offset=24 align=8 (local.get $out_fluxes)
      (f64.mul 
        (f64.add 
          (f64.mul (f64.mul (local.get $rho) (local.get $w)) (local.get $vn))
          (f64.mul (local.get $p) (local.get $nz))
        ) 
        (local.get $area)
      )
    )

    ;; energy = (p / 0.4) + 0.5 * rho * (u * u + v * v + w * w);
    (local.set $energy
      (f64.add
        (f64.div (local.get $p) (f64.const 0.4))
        (f64.mul 
          (f64.mul (f64.const 0.5) (local.get $rho))
          (f64.add
            (f64.add
              (f64.mul (local.get $u) (local.get $u))
              (f64.mul (local.get $v) (local.get $v))
            )
            (f64.mul (local.get $w) (local.get $w))
          )
        )
      )
    )

    ;; out_fluxes[4] = (energy + p) * vn * area;
    (f64.store offset=32 align=8 (local.get $out_fluxes)
      (f64.mul
        (f64.mul
          (f64.add (local.get $energy) (local.get $p))
          (local.get $vn)
        )
        (local.get $area)
      )
    )
  )
)
