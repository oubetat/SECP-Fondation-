add_library(cad-core STATIC
    geometry/geometry_kernel.cpp
    cad_kernel.cpp
)

target_include_directories(cad-core PUBLIC 
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/geometry
)
