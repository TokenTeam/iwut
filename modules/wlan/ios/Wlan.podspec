Pod::Spec.new do |s|
  s.name           = 'Wlan'
  s.version        = '1.0.0'
  s.summary        = '.'
  s.homepage       = 'https://github.com/tokenteam/iwut'
  s.author         = 'tokenteam'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.frameworks = 'Security'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
