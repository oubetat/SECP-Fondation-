cmake_minimum_required(VERSION 3.20)
project(SECP_Engines VERSION 0.1.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

message(STATUS "Configuring SECP Smart Engineering & CAD Platform Kernels...")

add_subdirectory(cad-core)
add_subdirectory(simulation-core)
add_subdirectory(manufacturing-core)

message(STATUS "SECP Engines configured successfully.")
