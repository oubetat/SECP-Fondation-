add_library(manufacturing-core STATIC
    gcode_generator.cpp
)

target_include_directories(manufacturing-core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
