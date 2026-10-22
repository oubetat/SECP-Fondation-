| الكيان | المعلومات المطلوبة |
| :--- | :--- |
| Fluid mesh | العقد (عبر الوجوه)، الوجوه (مع normal, area, centroid)، الخلايا (مع volume, centroid) |
| Interface face | ID, مساحة, متجه عمودي, ضغط/إجهاد مستخرج من الحل |
| Structural mesh | (عقد/عناصر) لم يتم تعريفها في `Fvm3DTypes` |
| Structural result | (إزاحات، ردود أفعال) تُستخرج من `TwoWayFSICouplingEngine` |
| Coupling state | حقول القوى، الإزاحات، بواقي التقارب، تكرارات الاقتران |
