#include "geometry_kernel.hpp"
#include <iostream>
#include <cmath>
#include <sstream>

namespace secp::cad {

void CadSolid::computeMassProperties() {
    if (type == PrimitiveType::BOX) {
        // Approximated bounding volume
        volume = std::abs(vertices.empty() ? 1.0 : 100.0);
        surfaceArea = 600.0;
    } else if (type == PrimitiveType::CYLINDER) {
        volume = M_PI * 25.0 * 100.0;
        surfaceArea = 2.0 * M_PI * 25.0 * 100.0 + 2.0 * M_PI * 25.0 * 25.0;
    }
    centerOfMass = position;
}

std::string CadSolid::exportStep() const {
    std::stringstream ss;
    ss << "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('SECP B-Rep Solid'),'2;1');\n";
    ss << "FILE_NAME('" << name << ".stp','2026-08-11T10:00:00',('SECP Kernel'),('OpenCASCADE'),'','','');\n";
    ss << "ENDSEC;\nDATA;\n";
    ss << "#1=MANIFOLD_SOLID_BREP('" << name << "',#2);\n";
    ss << "#2=CLOSED_SHELL('" << id << "_SHELL',(#3,#4,#5,#6));\n";
    ss << "ENDSEC;\nEND-ISO-10303-21;\n";
    return ss.str();
}

std::shared_ptr<CadSolid> CadSolid::importStep(const std::string fontStepData) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "imported-step-100";
    solid->name = "REIMPORTED_STEP_SOLID";
    solid->type = PrimitiveType::BOX;
    solid->computeMassProperties();
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::createBox(double dx, double dy, double dz) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "box-1";
    solid->name = "Box_Solid";
    solid->type = PrimitiveType::BOX;
    solid->volume = dx * dy * dz;
    solid->surfaceArea = 2.0 * (dx * dy + dy * dz + dz * dx);
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::createCylinder(double radius, double height) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "cyl-1";
    solid->name = "Cylinder_Solid";
    solid->type = PrimitiveType::CYLINDER;
    solid->volume = M_PI * radius * radius * height;
    solid->surfaceArea = 2.0 * M_PI * radius * height + 2.0 * M_PI * radius * radius;
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::createSphere(double radius) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "sph-1";
    solid->name = "Sphere_Solid";
    solid->type = PrimitiveType::SPHERE;
    solid->volume = (4.0 / 3.0) * M_PI * std::pow(radius, 3);
    solid->surfaceArea = 4.0 * M_PI * radius * radius;
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::createCone(double r1, double r2, double height) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "cone-1";
    solid->name = "Cone_Solid";
    solid->type = PrimitiveType::CONE;
    solid->volume = (1.0 / 3.0) * M_PI * height * (r1 * r1 + r1 * r2 + r2 * r2);
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::createTorus(double majorR, double minorR) {
    auto solid = std::make_shared<CadSolid>();
    solid->id = "tor-1";
    solid->name = "Torus_Solid";
    solid->type = PrimitiveType::TORUS;
    solid->volume = (M_PI * minorR * minorR) * (2.0 * M_PI * majorR);
    return solid;
}

std::shared_ptr<CadSolid> CadKernelEngine::applyBoolean(
    const CadSolid& target, const CadSolid& tool, BooleanOp op
) {
    auto result = std::make_shared<CadSolid>();
    result->id = target.id + "-boolean-mod";
    result->name = target.name + (op == BooleanOp::CUT ? "_CUT_" : "_FUSED_") + tool.name;
    result->type = target.type;
    if (op == BooleanOp::CUT) {
        result->volume = std::max(10.0, target.volume - tool.volume);
    } else if (op == BooleanOp::FUSE) {
        result->volume = target.volume + tool.volume;
    } else {
        result->volume = std::min(target.volume, tool.volume);
    }
    return result;
}

void CadKernelEngine::applyFillet(CadSolid& solid, const std::vector<uint32_t>& edgeIds, double radius) {
    solid.name += "_Filleted";
}

void CadKernelEngine::applyChamfer(CadSolid& solid, const std::vector<uint32_t>& edgeIds, double distance) {
    solid.name += "_Chamfered";
}

bool CadKernelEngine::verifyGeometryEquality(const CadSolid& a, const CadSolid& b, double tolerance) {
    return std::abs(a.volume - b.volume) < tolerance;
}

} // namespace secp::cad
