# Windows licensing test over Tailscale

This uses the Mac's local Laravel website and database. The website is available only to devices on the same Tailscale network. Tailscale encrypts the connection between the machines; the local development server itself uses HTTP. No Expose tunnel, Windows website checkout, or Tailscale Serve setting is needed.

1. Start Tailscale on the Mac and Windows PC.
2. On the Mac, run `bash scripts/serve-local-website.sh /path/to/filearchitect-website` from the public app checkout. Keep that terminal open. The script prints the private HTTP URL.
3. On Windows, confirm the printed URL plus `/api/updates/macos/latest` responds. From the public app checkout in PowerShell, run:

   ```powershell
   $env:VITE_APP_URL = "<private HTTP URL printed by the Mac script>"
   $env:VITE_API_URL = "$env:VITE_APP_URL/api/v1"
   pnpm tauri dev --config src-tauri/tauri.tailnet-test.conf.json
   ```

   The extra configuration enables the private URL only for this test build. Normal and production builds include only `default-capability`.

4. Create a disposable key on the Mac website with `php artisan tinker` from its checkout:

   ```php
   $key = 'fa-test-'.\Illuminate\Support\Str::random(24);
   \App\Models\License::create(['license_key' => $key, 'type' => 'once', 'machine_limit' => 1]);
   echo $key;
   ```

   Test first activation and repeat validation on Windows. Restart the app and check the Account state. Try the same key with a different `VITE_OVERRIDE_MACHINE_ID` in a development build to confirm machine-limit rejection. Check that an app already at the current public version reports no update. Do not use a customer key.

The Mac and PC must be online on the same tailnet. The test capability accepts the private development port on `*.ts.net` only when the extra test configuration is selected. Stopping the Laravel command closes the test server.
