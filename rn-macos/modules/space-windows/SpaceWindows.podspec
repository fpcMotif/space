require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SpaceWindows"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://example.com/space"
  s.license      = package["license"]
  s.authors      = "Space"
  s.osx.deployment_target = "14.0"
  s.source       = { :path => "." }
  s.source_files = "macos/**/*.{h,m}"
  s.dependency "React-Core"
end
