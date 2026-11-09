# My Home: a clean home screen for Samsung TVs

An Apple TV-style home screen for Samsung (Tizen) TVs: your favourite apps, your HDMI inputs, an "All Apps" screen, a clock, and no ads. It runs on the TV through [TizenBrew](https://github.com/reisxd/TizenBrew).

## What works today

| Part | Status |
| --- | --- |
| Home screen, All Apps screen, remote navigation, clock | Tested on a computer |
| Opening apps, reading the TV's installed-app list | Written, **not yet tested on a real TV** |
| HDMI input tiles | Experimental, **not yet tested on a real TV**; may be refused by the TV |
| Taking over the remote's Home button | Not included |

## Try it on your computer

```bash
npm run preview
```

Then open <http://localhost:4173>. Arrow keys move, Enter selects, Escape goes back, D shows each app's id. Nothing really opens in preview: a message says what the TV would do.

## Change what is on the home screen

Edit [app/config.js](app/config.js):

- `favourites`: which apps appear on the home screen, and in what order.
- `sources`: the input tiles. Rename `HDMI 1` to `PlayStation`, and so on.
- `catalog`: names and colours for known apps. Any other installed app still shows up in All Apps with a coloured tile.

## Put it on the TV

1. **Find your model.** On the TV: Settings → Support → About This TV. The install route for step 3 depends on the year.
2. **Turn on Developer Mode.** Open the Apps screen, type `12345` on the remote, switch Developer Mode on, set the host IP to `127.0.0.1`, then restart the TV.
3. **Install TizenBrew** by following its [official guide](https://github.com/reisxd/TizenBrew). This is the hard step: it is done from a computer, and 2024-and-newer TVs need a Samsung certificate tied to that TV.
4. **Publish this folder to a public GitHub repository.** TizenBrew loads modules from GitHub, so the TV cannot read the files straight from this computer.
5. **Add the module.** In TizenBrew: Module Manager → Add GitHub Module → type `your-github-name/samsung-tv-launcher`, then open the "My Home" tile.

After a change, push it to GitHub and reopen the module. The delivery network TizenBrew uses can take up to about 12 hours to show the new version.

## Limits

- Ads inside apps (YouTube, an ad-supported Netflix plan) are not affected.
- Samsung's own home screen is still there and still opens with the Home button.
- New apps are still installed from Samsung's app store.
- A Samsung firmware update can break TizenBrew, and this launcher with it.

## Tests

```bash
npm test
```
