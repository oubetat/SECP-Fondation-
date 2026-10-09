add_library(simulation-core STATIC
    simulation_kernel.cpp
)

target_include_directories(simulation-core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
