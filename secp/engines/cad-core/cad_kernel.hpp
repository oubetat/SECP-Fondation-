#ifndef SECP_CAD_KERNEL_HPP
#define SECP_CAD_KERNEL_HPP

#include <string>
#include <vector>

namespace secp::cad {

struct Vector3D {
    double x{0.0};
    double y{0.0};
    double z{0.0};
};

struct BoundingBox {
    Vector3D min;
    Vector3D max;
};

class CadKernel {
public:
    CadKernel();
    ~CadKernel();

    std::string getVersion() const;
    bool initializeKernel();
    BoundingBox computeBoundingBox(const std::vector<Vector3D>& vertices) const;
};

} // namespace secp::cad

#endif // SECP_CAD_KERNEL_HPP
