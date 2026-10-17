# ML Kit discovers component registrars through manifest metadata and reflection.
# AGP 9 / R8 strict keep rules require explicitly preserving their constructors.
-keep,allowoptimization class com.google.mlkit.** implements com.google.firebase.components.ComponentRegistrar {
    public <init>();
}
