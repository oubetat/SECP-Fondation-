#include "cad_kernel.hpp"
#include <iostream>
#include <algorithm>
#include <limits>

namespace secp::cad {

CadKernel::CadKernel() {
    std::cout << "[SECP C++ CadKernel] Engine initialized." << std::endl;
}

CadKernel::~CadKernel() {
    std::cout << "[SECP C++ CadKernel] Engine shutdown." << std::endl;
}

std::string CadKernel::getVersion() const {
    return "SECP-CAD-Kernel v0.1.0-alpha (C++20)";
}

bool CadKernel::initializeKernel() {
    return true;
}

BoundingBox CadKernel::computeBoundingBox(const std::vector<Vector3D>& vertices) const {
    BoundingBox bbox;
    if (vertices.empty()) return bbox;

    double minX = std::numeric_limits<double>::max();
    double minY = std::numeric_limits<double>::max();
    double minZ = std::numeric_limits<double>::max();
    double maxX = std::numeric_limits<double>::lowest();
    double maxY = std::numeric_limits<double>::lowest();
    double maxZ = std::numeric_limits<double>::lowest();

    for (const auto& v : vertices) {
        minX = std::min(minX, v.x);
        minY = std::min(minY, v.y);
        minZ = std::min(minZ, v.z);
        maxX = std::max(maxX, v.x);
        maxY = std::max(maxY, v.y);
        maxZ = std::max(maxZ, v.z);
    }

    bbox.min = {minX, minY, minZ};
    bbox.max = {maxX, maxY, maxZ};
    return bbox;
}

} // namespace secp::cad
