const app = angular.module('YepTextures', ['ui.bootstrap'])

app.config(function($sceProvider, $compileProvider, $locationProvider) {
  $locationProvider.hashPrefix('')
  if (!location.host.startsWith('localhost')) {
    $locationProvider.html5Mode({
      enabled: true,
      requireBase: false
    })
  }

  $sceProvider.enabled(false)
  $compileProvider.debugInfoEnabled(false) // more perf
})

app.controller('RootCtrl', ['$scope', '$http', '$location', function($scope, $http, $location) {
  const vm = this
  this.loading = true
  this.loadError = false
  this.textures = []
  this.versions = []

  const DEFAULT_PAGE_SIZE = 500

  const query = $location.search()
  this.searchText = query.q || ''
  this.pageSize = +query.pageSize || DEFAULT_PAGE_SIZE
  this.currentPage = +query.page || 1
  this.totalItems = 0
  this.isLargeImage = false
  this.filterVersion = 0
  this.filterState = +query.state || 0

  this.user = null

  this.onPageSizeChange = () => {
    $location.search('pageSize', this.pageSize === DEFAULT_PAGE_SIZE ? null : this.pageSize)
  }

  this.onSearchChange = () => {
    $location.search('q', this.searchText === '' ? null : this.searchText)
  }

  this.onPageChange = () => {
    $location.search('page', this.currentPage === 1 ? null : this.currentPage)
  }

  this.onVersionChange = () => {
    $location.search('version', this.filterVersion === 0 ? null : getVersionName(this.filterVersion))
  }

  this.onStateChange = () => {
    $location.search('state', this.filterState === 0 ? null : this.filterState)
  }

  this.toggleImageSize = () => {
    this.isLargeImage = !this.isLargeImage
  }

  function getVersionName(versionId) {
    return versionId === 0 ? 'All' : vm.versions.find(v => v.id === versionId).name
  }

  function getVersionId(versionName) {
    return vm.versions.find(v => v.name === versionName)?.id ?? 0
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
    } else {
      const input = document.createElement('input')
      input.value = text
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
  }

  this.clickItem = item => {
    copyToClipboard(item.id)
    console.log(item)
  }

  this.texturesFilter = item => {
    let shouldShow = true

    if (this.searchText) {
      const searchText = this.searchText.toLowerCase()
      shouldShow = item.id.toLowerCase().includes(searchText) || item.id_raw.toString() === searchText
    }

    if (this.filterState > 0 && this.filterVersion > 0) {
      if (this.filterState === 2) {
        shouldShow = item.version_removed_id === this.filterVersion
      } else if (this.filterState === 3) {
        shouldShow = item.version_updated_id === this.filterVersion
      } else {
        shouldShow = item.version_added_id === this.filterVersion
      }
    } else {
      if (shouldShow && this.filterVersion > 0) {
        shouldShow = item.version_added_id === this.filterVersion
      }

      if (shouldShow && this.filterState > 0) {
        shouldShow = this.filterState === 2 ? item.is_removed : this.filterState === 3 ? item.is_updated : item.is_new
      }
    }

    return shouldShow
  }

  function getTextureId(id) {
    const hexId = id.toString(16).toUpperCase()
    return hexId.padStart(12, '0')
  }

  this.logout = async () => {
    try {
      await $http.post('/api/auth/logout')
      window.location.reload()
    } catch (err) {
      console.error('Failed to logout', err)
    }
  }

  this.getDiscordLoginUrl = () => {
    const redirectUri = encodeURIComponent(`${location.origin}/api/auth/discord_login`)  
    return `https://discord.com/api/oauth2/authorize?client_id=1343405239872786543&redirect_uri=${redirectUri}&response_type=code&scope=identify+guilds`
  }

  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
      const payload = JSON.parse(jsonPayload)
      // check if the token is expired
      if (payload.exp < Date.now() / 1000) {
        console.error('Token expired')
        return null
      }

      return payload
    } catch (e) {
      return null
    }
  }

  function getCookie(name) {
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop().split(';').shift()
    return null
  }

  const checkLoginStatus = () => {
    const token = getCookie('token')
    if (token) {
      const userData = parseJwt(token)
      if (userData) {
        vm.user = {
          name: userData.name,
          guid: userData.guid,
          isAdmin: userData.admin
        }
      }
    }
  }

  vm.$onInit = async () => {
    checkLoginStatus()
    try {
      const response = await $http.get('https://assets.overwatchitemtracker.com/data/texture_info.json')

      const textureInfo = response.data
      vm.textures = textureInfo.textures.map((texId, i) => {
        const textureId = getTextureId(texId)
        const versionAddedId = textureInfo.tex_ver_added[i]
        const versionRemovedId = textureInfo.tex_ver_removed[i]
        const versionUpdatedId = textureInfo.tex_ver_updated[i]

        return {
          id: textureId,
          id_raw: texId,
          version_added_id: versionAddedId,
          version_removed_id: versionRemovedId,
          version_updated_id: versionUpdatedId,
          version_added: textureInfo.versions[versionAddedId - 1],
          version_removed: textureInfo.versions[versionRemovedId - 1],
          version_updated: textureInfo.versions[versionUpdatedId - 1],
          is_removed: versionRemovedId !== 0,
          is_new: versionAddedId === textureInfo.versions.length,
          is_updated: versionUpdatedId === textureInfo.versions.length,
          url: vm.getImageUrl(textureId)
        }
      })

      this.versions = [
        { id: 0, name: 'All' },
        ...textureInfo.versions.map((name, i) => ({ id: i + 1, name }))
      ]

      // Set the filter version to the version id, we have to do this after the versions are loaded
      vm.filterVersion = getVersionId(query.version)
      vm.totalItems = vm.textures.length
      console.log('Loaded textures', vm.textures)
    } catch (err) {
      console.error('Failed to load textures', err)
      vm.loadError = true
    } finally {
      vm.loading = false
      $scope.$applyAsync()
    }
  }

  this.getImageUrl = id => {
    return `https://assets.overwatchitemtracker.com/textures/${id}.png`
  }
}])
