# SDK 58 workaround from the merged upstream fix:
# https://github.com/expo/expo/pull/51204
# Remove these extra rules once the installed expo-modules-core ships them.

# Expo Modules v2: ExpoModulesV2Host loads the generated list and the modules by reflection.
-keep class expo.modules.ExpoModulesV2ModuleList { public <init>(); }
-keep class * extends io.github.expo.modules.v2.Module {
    <init>();
    static ** INSTANCE;
}
# The v2 C++ runtime reaches these through JNI, and the artifacts ship no consumer rules.
-keep class io.github.expo.kolibri.** { *; }
-keep class io.github.expo.modules.v2.** { *; }
# JNI calls exported members and generated trampolines by name.
# A record registers its codec from the static `recordCodec$ExpoModulesV2` field initializer.
-keepclassmembers class * {
    @io.github.expo.modules.v2.JS *;
    @io.github.expo.modules.v2.Constant *;
    @io.github.expo.modules.v2.Event *;
    *** *$ExpoModulesV2(...);
    static ** *$ExpoModulesV2;
}
-keep class **$ExpoModulesV2 { <init>(); }
# Kotlin puts property annotations on a synthetic method, so the getters need a rule of their own.
-keepclassmembers class * extends io.github.expo.modules.v2.Module { public *; }
-keepclassmembers class * extends io.github.expo.modules.v2.SharedObject { public *; }
# EnumConverter reads an enum's only property field by reflection, and v2 enums have no marker type.
# Scope it to enums in the package (and subpackages) of a v2 module or shared object.
-if class **.* extends io.github.expo.modules.v2.Module
-keepclassmembers,allowobfuscation enum <1>.** { !static <fields>; }
-if class **.* extends io.github.expo.modules.v2.SharedObject
-keepclassmembers,allowobfuscation enum <1>.** { !static <fields>; }
