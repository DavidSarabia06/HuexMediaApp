from urllib.request import urlopen
from urllib.parse import urljoin, urlparse, urldefrag, unquote
from html.parser import HTMLParser
import json

base = 'http://127.0.0.1:8000/'
class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.ids=set()
    def handle_starttag(self, tag, attrs):
        data=dict(attrs)
        if data.get('id'): self.ids.add(data['id'])
        if tag == 'a' and data.get('href'): self.links.append(data['href'])
pages = ['', 'sistemas/categorias-series/', 'sistemas/categorias-series/servicio/', 'codigo/SeriesCategoryService/', 'codigo/SeriesCategory/', 'codigo/SeriesCategoriesController/']
cache={}
for path in pages:
    url=urljoin(base,path)
    with urlopen(url) as response:
        assert response.status == 200
        html=response.read().decode('utf-8')
    parser=Page();parser.feed(html);cache[url]=parser
for url, parser in list(cache.items()):
    for link in parser.links:
        target, fragment=urldefrag(urljoin(url,link))
        if not target.startswith(base): continue
        if target not in cache:
            with urlopen(target) as response:
                assert response.status == 200
                data=response.read().decode('utf-8')
            other=Page();other.feed(data);cache[target]=other
        if fragment:
            assert unquote(fragment) in cache[target].ids, (url,link)
with urlopen(urljoin(base,'search/search_index.json')) as response: index=json.load(response)
assert any('CreateAsync' in item['text'] for item in index['docs'])
print(f'OK: {len(cache)} paginas y enlaces internos accesibles, anclas resueltas e indice de busqueda con funciones')
