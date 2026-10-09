// C++ CAD Geometry Kernel Header - OpenCASCADE Inspired Topology & Geometry Architecture
#ifndef SECP_GEOMETRY_KERNEL_HPP
#define SECP_GEOMETRY_KERNEL_HPP

#include <string>
#include <vector>
#include <memory>

namespace secp::cad {

enum class PrimitiveType { BOX, CYLINDER, SPHERE, CONE, TORUS };
enum class BooleanOp { FUSE, CUT, COMMON };

struct Vec3 {
    double x{0.0}, y{0.0}, z{0.0};
};

struct PrimitiveBoxParams { double dx, dy, dz; };
struct PrimitiveCylinderParams { double radius, height; };
struct PrimitiveSphereParams { double radius; };
struct PrimitiveConeParams { double r1, r2, height; };
struct PrimitiveTorusParams { double majorR, minorR; };

class CadSolid {
public:
    std::string id;
    std::string name;
    PrimitiveType type;
    Vec3 position;
    Vec3 rotation; // Euler angles in radians
    
    // Geometry B-Rep Mesh
    std::vector<Vec3> vertices;
    std::vector<uint32_t> indices;
    
    // Physical Properties
    double volume{0.0};
    double surfaceArea{0.0};
    Vec3 centerOfMass;

    void computeMassProperties();
    std::string exportStep() const;
    static std::shared_ptr<CadSolid> importStep(const std::string fontStepData);
};

class CadKernelEngine {
public:
    static std::shared_ptr<CadSolid> createBox(double dx, double dy, double dz);
    static std::shared_ptr<CadSolid> createCylinder(double radius, double height);
    static std::shared_ptr<CadSolid> createSphere(double radius);
    static std::shared_ptr<CadSolid> createCone(double r1, double r2, double height);
    static std::shared_ptr<CadSolid> createTorus(double majorR, double minorR);

    static std::shared_ptr<CadSolid> applyBoolean(
        const CadSolid& target, const CadSolid& tool, BooleanOp op
    );

    static void applyFillet(CadSolid& solid, const std::vector<uint32_t>& edgeIds, double radius);
    static void applyChamfer(CadSolid& solid, const std::vector<uint32_t>& edgeIds, double distance);
    
    static bool verifyGeometryEquality(const CadSolid& a, const CadSolid& b, double tolerance = 1e-6);
};

} // namespace secp::cad

#endif
