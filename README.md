# Menus scolaires d’Alfortville

Application française, statique et adaptée au mobile. Sélection initiale : **Dolet maternelle → Maternelle**. Déjeuner et prestation froide sont réunis dans le même calendrier, sans boutons distincts. Les établissements et convives proviennent de la source officielle. « Repas froid » correspond au libellé officiel « Prestation simplifiée froide ». Un repas froid porte un badge à sa date. Si les deux sources publient des plats le même jour, les deux menus sont affichés séparément dans la même carte, avec un avertissement explicite ; aucune cause de remplacement ni grève n’est déduite.

## Utilisation locale

Prérequis : Python 3 pour servir les fichiers ; Node.js 22 ou récent pour les tests. Aucune dépendance npm à installer.

```sh
npm start
npm test
```

Ouvrir http://127.0.0.1:4178/. Un serveur HTTP est nécessaire pour les modules JavaScript. L’application est installable comme raccourci mobile ; son service worker conserve seulement les fichiers de l’interface. Les menus passent par le cache explicite décrit ci-dessous.

## Source et actualisation

Page officielle : https://sudestavenir.fr/votre-quotidien/votre-restauration/alfortville-scolaires-1/

Cette page intègre le module public https://infoconso-gpsea.salamandre.tm.fr/lscom/index.html#!/Menus/1. Les requêtes de lecture utilisées par ce module sont exposées sans authentification par :

`https://infoconso-gpsea.salamandre.tm.fr/API/public/v1/`

Chemins vérifiés :

- `Etablissements/1` : établissements scolaires d’Alfortville.
- `Convives/72` : convives de Dolet maternelle.
- `Menus/72/2` : Déjeuner (`2`) et Prestation simplifiée froide (`17`) pour Maternelle (`2`).
- `Semaine/72/2/2/2026-11-02` : vrais plats de la semaine du 2 novembre 2026.

L’API répond avec `Access-Control-Allow-Origin: *`. La récupération directe dans le navigateur a été vérifiée depuis l’aperçu local. Aucun jeton, cookie, contournement anti-robot ou serveur intermédiaire n’est utilisé. La protection HTTP 418 du site principal n’est pas contournée : le module intégré propose lui-même cette API publique distincte.

L’application redemande les données à chaque ouverture, changement de sélection ou de semaine, actualisation manuelle, et toutes les 15 minutes tant que la page est visible. Au retour sur la page, elle vérifie si la dernière tentative date de plus de 5 minutes. Le changement de journée est calculé en `Europe/Paris`. Une page fermée n’effectue pas de requête ; à la réouverture, elle récupère les nouveaux menus. **Aucun cron ni GitHub Action n’est nécessaire** : les données sont lues à l’exécution et ne sont pas compilées dans le site.

La date « Vérifié le » indique la récupération, jamais une date de publication supposée. L’API ne fournit pas de date de publication. Les deux types sont récupérés en parallèle et fusionnés par date. Un résultat valide sans plats dans les deux sources est affiché comme « Pas de menu publié », sans affirmer qu’il n’y a pas école. Les jours fériés sont affichés seulement si la source les indique.

## Pannes et copies locales

Les réponses sont validées. Si un type de repas ne peut être récupéré, l’état « Vérification partielle » indique le type manquant et conserve les autres résultats sans masquer cette incertitude. Une panne réseau, un délai dépassant 15 secondes, un HTTP d’échec ou un format inattendu ne deviennent jamais un menu vide réussi. Une copie locale est isolée par établissement, convives, repas et lundi de la semaine. En cas de panne seulement, elle peut être affichée avec sa date initiale et la mention « Menus à confirmer ». Une copie de plus de 24 heures porte la mention « Copie ancienne ». Sans copie exacte, l’écran annonce l’indisponibilité et propose le site officiel. Les réponses annulées par une nouvelle sélection sont ignorées.

Les tags de labels sont transformés en texte et badges ; aucun HTML de la source n’est exécuté. Alternatives et ingrédients sont uniquement ceux fournis. Cette application ne calcule pas d’allergènes et ne remplace pas les informations de la restauration scolaire.

## Publication GitHub Pages

Projet autonome à la racine de son propre dépôt. Ne jamais copier ni modifier un autre projet. La visibilité et le dépôt de destination doivent être confirmés avant création. Le compte réellement renvoyé par `gh api user` lors de la préparation était `Valkim-dev` ; le nom local de `gh auth status` était ancien.

Après validation de la destination, pousser uniquement ce répertoire dans le nouveau dépôt, branche `main`. Activer GitHub Pages avec la source **Deploy from a branch → main → /(root)**. `.nojekyll` est fourni. Le site n’a pas d’étape de compilation ni de secret de déploiement.

Vérifier ensuite le lien HTTPS renvoyé par GitHub Pages, le chargement réel des plats dans le navigateur sur ce domaine, le changement de semaine et la catégorie froide. La compatibilité CORS doit être revérifiée sur le domaine publié ; un aperçu local seul ne prouve pas le déploiement. Les délais et disponibilités de GitHub Pages et de l’API restent externes au projet. GitHub peut désactiver Pages selon les droits et l’offre du compte, notamment pour un dépôt privé.

## Confidentialité et vérification

Aucun nom d’enfant, compte, profil personnel, analytique ou publicité. Les préférences restent dans le navigateur. Les captures de référence ne sont pas publiées (`references/` est ignoré). Le fixture de tests est une réponse publique de l’API, datée et utilisée uniquement pour tester le code ; l’application ne l’utilise jamais comme menu de secours.

`npm test` couvre dates et changement d’année, jour de Paris, conservation des alternatives, cache isolé, échecs HTTP et de format, remplacement d’une copie par une réponse vide valide, délai dépassé et annulation.

Vérification du 6 novembre 2026 : 10 tests réussis. Dans Chrome, les plats réels ont été chargés depuis l’API, le jeudi 5 a affiché le repas froid dans le même calendrier, et la semaine du 9 au 13 novembre a affiché ses propres plats ainsi que le jour férié du 11 fourni par la source. Les vues Jour et Semaine ont été contrôlées. Aucun débordement horizontal observé aux largeurs CSS mesurées de 390, 433 et 1422 pixels. Le mode semaine passe de cartes empilées sur mobile à cinq colonnes sur ordinateur. Les vérifications de panne et de cache sont des tests automatisés ; aucune panne du fournisseur n’a été provoquée.

Publication autorisée dans le dépôt public `Valkim-dev/menus-alfortville`, avec GitHub Pages depuis la branche `main` à la racine. Les données restent récupérées à l’exécution depuis l’API publique, sans reconstruction du site chaque semaine.

## Navigation et vues

Les flèches précédente/suivante sélectionnent toujours le lundi de la semaine cible, quel que soit le jour consulté. Le bouton « Revenir à aujourd’hui » reste indépendant. Sur téléphone (600 pixels CSS ou moins), la vue Jour affiche le menu détaillé du jour sélectionné ; la vue Semaine présente cinq lignes compactes avec date, plat principal et indication de repas froid. Toucher une ligne déplie tous les plats et les informations de la source. Sur ordinateur, la vue Semaine conserve ses cartes en colonnes. Le rendu s’adapte aussi lorsqu’on change la largeur de la fenêtre.
