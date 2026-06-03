---
last-verified: 2026-05-26
sources:
- https://dev.epicgames.com/documentation/unreal-engine/linux-development-requirements-for-unreal-engine?application_version=5.7#version-history
- https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-5-7-release-notes?application_version=5.7
---

# Unreal Linux Server Packaging

Use this synthetic reference when an Unreal project needs a Linux dedicated server package for AMS upload.

AMS requires a Linux x86/x64 dedicated server build. Local Windows or editor-hosted `amssim` tests only validate behavior; they are not the upload artifact.

## UE 5.7 Linux Toolchain Notes

For Unreal Engine 5.7, check Epic's Linux development requirements before packaging. The UE 5.7 release notes list native Linux development with Ubuntu 22.04 / Rocky Linux 8 or newer and clang 20.1.8; the cross-compile toolchain is based on v26 clang 20.1.8. If Linux packaging fails from Windows, verify the UE 5.7 Linux cross-compilation toolchain is installed and that the engine build supports the Linux server platform.

## Server Target Requirement

The `-servertarget=<ProjectName>Server` option requires a server target file in the project, usually:

```text
Source/<ProjectName>Server.Target.cs
```

The target must set:

```csharp
Type = TargetType.Server;
```

Example:

```csharp
using UnrealBuildTool;
using System.Collections.Generic;

public class MyGameServerTarget : TargetRules
{
    public MyGameServerTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Server;
        DefaultBuildSettings = BuildSettingsVersion.Latest;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.AddRange(new string[] { "MyGame" });
    }
}
```

If `-servertarget=MyGameServer` is used but `MyGameServer.Target.cs` is missing or does not use `TargetType.Server`, Unreal Build Tool will not have a valid dedicated server target.

Some installed engine distributions may not support server targets or Linux cross-compilation. If packaging reports that server targets are not supported from the engine distribution, switch to an engine build/distribution that supports dedicated server targets.

## RunUAT BuildCookRun Example

Package a Linux dedicated server from Windows:

```powershell
& "C:\path\to\UE_5.7\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun `
  -project="C:\path\to\MyGame\MyGame.uproject" `
  -noP4 `
  -server `
  -serverplatform=Linux `
  -servertarget=MyGameServer `
  -serverconfig=Development `
  -cook `
  -build `
  -stage `
  -pak `
  -archive `
  -archivedirectory="C:\path\to\MyGame\Packaged\LinuxServer"
```

Adapt the paths and target names:

- `RunUAT.bat`: the UE 5.7 engine path.
- `-project`: absolute path to the `.uproject`.
- `-serverplatform=Linux`: target Linux server output.
- `-servertarget`: server target class name without `.Target.cs`.
- `-serverconfig`: `Development` for smoke/integration testing, `Shipping` for production-like uploads when the project is ready.
- `-archivedirectory`: output folder for the staged archive.

## Before AMS Upload

After packaging:

1. Locate the archived Linux server folder under `-archivedirectory`.
2. Identify the server executable or startup script relative to the upload folder.
3. If using a startup shell script, ensure LF line endings and executable permissions.
4. Verify the package includes required config, content, plugins, and runtime dependencies.
5. Upload the Linux server folder with `/ags ams upload`.

Do not upload Windows server artifacts to AMS.
